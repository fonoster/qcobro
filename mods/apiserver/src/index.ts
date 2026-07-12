import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createIdentityClient } from "@fonoster/identity-client";
import { appRouter } from "./trpc/index.js";
import { createContext } from "./trpc/context.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { createContactLogHandler } from "./rest/contactLogs.js";
import { createVoiceEventsHandler } from "./rest/voiceEvents.js";
import { createSettleVoiceUsage } from "./functions/billing/settleVoiceUsage.js";
import { createStripeWebhookHandler } from "./rest/stripeWebhook.js";
import {
  createStripeGateway,
  createStripeSdk,
  validateStripePrices
} from "./services/stripeGateway.js";
import { createEmailInboundHandler } from "./rest/emailInbound.js";
import { createWhatsAppWebhookHandlers } from "./rest/whatsAppWebhook.js";
import { createEngineEventsHandler } from "./rest/engineEvents.js";
import { resolveWhatsAppClient } from "./services/resolveWhatsAppClient.js";
import { createInsightGenerator } from "./services/insightGenerator.js";
import { synthesizeSpeech } from "./services/elevenLabsTts.js";
import { startVoiceServer } from "./voice/voiceServer.js";
import { startEngine } from "./engine/start.js";
import {
  createPrismaEngineEventSink,
  createProviderEventRecorder,
  type ProviderEventPrisma
} from "./engine/eventSink.js";

const app = express();
const port = config.apiserver.port;

// Flight recorder (engine-events capability): inbound provider signals are recorded
// alongside the engine's own tick events, best-effort, one recorder per source.
const engineEventSink = createPrismaEngineEventSink(prisma);
const providerEvents = (source: Parameters<typeof createProviderEventRecorder>[2]) =>
  createProviderEventRecorder(prisma as unknown as ProviderEventPrisma, engineEventSink, source);

app.use(cors());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as typeof req & { rawBody: string }).rawBody = buf.toString("utf8");
    }
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// External contact-log ingress (e.g. Fonoster voice callbacks). Workspace-scoped
// HTTP Basic auth, gated by config; shares hot-path updates with the tRPC path.
app.post(
  "/api/contact-logs",
  createContactLogHandler(prisma, config, providerEvents("contact-logs"))
);

// Fonoster autopilot events-hook for Voz IA calls (conversation.started / .ended).
// FIXME(security): UNAUTHENTICATED — must be secured very soon (see handler note).
app.post(
  "/api/voice/events",
  createVoiceEventsHandler(prisma as never, {
    generator: createInsightGenerator(config.ai),
    generation: config.ai?.generation ?? "onDemand",
    recordEvent: providerEvents("voice-events"),
    // Billing settlement: replace the dispatch-time voice estimate with the
    // increment-billed amount for the answered duration (idempotent per ref).
    settleUsage: config.billing?.enabled ? createSettleVoiceUsage(prisma as never) : null
  })
);

// Resend inbound replies for the EMAIL autopilot — correlate to the gestión by reply-to
// token and run the autopilot decision loop. Verifies the shared secret when configured.
app.post(
  "/api/email/inbound",
  createEmailInboundHandler(prisma, {
    resend: config.resend,
    ai: config.ai,
    recordEvent: providerEvents("email-inbound")
  })
);

// Meta WhatsApp Business API webhook: GET for the verify-token handshake (subscribe
// flow), POST for signed event delivery (customer messages, delivery receipts, opt-outs).
const whatsapp = createWhatsAppWebhookHandlers(prisma, {
  appSecret: config.whatsapp?.appSecret,
  ai: config.ai,
  maxRepliesDefault: config.whatsapp?.maxRepliesDefault ?? 3,
  resolveWhatsApp: (workspaceRef, phoneNumberId) =>
    resolveWhatsAppClient(prisma as never, workspaceRef, config.whatsapp, phoneNumberId),
  recordEvent: providerEvents("meta-whatsapp")
});
app.get("/api/whatsapp/webhook", (req, res) => void whatsapp.verify(req, res));
app.post("/api/whatsapp/webhook", (req, res) => void whatsapp.events(req, res));

// Stripe webhook (billing-accounts capability): checkout provisioning, cycle
// turnover on invoice.paid, dunning on payment failure. Signature-verified
// against the raw body; registered only when billing + Stripe are configured.
const stripeGateway = createStripeGateway(config.billing);
const stripeSdk = createStripeSdk(config.billing);
if (config.billing?.enabled && stripeGateway && stripeSdk) {
  const billing = config.billing;
  app.post(
    "/api/stripe/webhook",
    createStripeWebhookHandler(prisma as never, stripeSdk, stripeGateway, billing)
  );
  // Startup drift check: catalog monthlyPrice vs the live Stripe price amounts.
  void validateStripePrices(stripeGateway, billing);
}

// Read-only flight-recorder export (engine-events capability): workspace-scoped
// event stream + engine parameters, consumed by the `engine-eval` CLI (@qcobro/common).
// Auth is a workspace API key (accessKeyId:accessKeySecret) as HTTP Basic, validated
// against the same Identity exchange the SDK's API-key login uses.
app.get(
  "/api/engine/events",
  createEngineEventsHandler(prisma, config, createIdentityClient(config.identity.endpoint))
);

// Synthesize a pre-recorded agent's script to audio (ElevenLabs) so the Pre-grabada
// gestión detail can play it. Cached in-memory per voice+text; 503 when TTS isn't
// configured (the player then has nothing to play).
const ttsCache = new Map<string, Buffer>();
const DEMO_TTS_VOICE = config.fonoster?.voices?.[0]?.id ?? "86V9x9hrQds83qf7zaGn";
app.get("/api/voice/tts", async (req, res) => {
  const text = typeof req.query.text === "string" ? req.query.text : "";
  const voiceId = (typeof req.query.voiceId === "string" && req.query.voiceId) || DEMO_TTS_VOICE;
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const key = `${voiceId}:${text}`;
  try {
    let audio = ttsCache.get(key);
    if (!audio) {
      audio = await synthesizeSpeech(text, voiceId);
      ttsCache.set(key, audio);
    }
    res.setHeader("content-type", "audio/mpeg");
    res.setHeader("cache-control", "public, max-age=86400");
    res.send(audio);
  } catch {
    res.status(503).json({ error: "TTS unavailable" });
  }
});

// Internal API. A future change can mount a public REST/OpenAPI router on a
// separate path (e.g. /api) alongside this one.
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// External voice application for pre-recorded agents (own port).
startVoiceServer();

// Campaigns engine — the autonomous tick that originates outreach (only when
// engine.enabled; off in dev). Stopped gracefully so an in-flight tick can settle.
const engineRunner = startEngine();
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    void engineRunner?.stop().finally(() => process.exit(0));
  });
}
