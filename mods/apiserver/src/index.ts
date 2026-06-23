import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./trpc/index.js";
import { createContext } from "./trpc/context.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { createContactLogHandler } from "./rest/contactLogs.js";
import { createVoiceEventsHandler } from "./rest/voiceEvents.js";
import { createInsightGenerator } from "./services/insightGenerator.js";
import { synthesizeSpeech } from "./services/elevenLabsTts.js";
import { startVoiceServer } from "./voice/voiceServer.js";

const app = express();
const port = config.apiserver.port;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// External contact-log ingress (e.g. Fonoster voice callbacks). Workspace-scoped
// HTTP Basic auth, gated by config; shares hot-path updates with the tRPC path.
app.post("/api/contact-logs", createContactLogHandler(prisma, config));

// Fonoster autopilot events-hook for Voz IA calls (conversation.started / .ended).
// FIXME(security): UNAUTHENTICATED — must be secured very soon (see handler note).
app.post(
  "/api/voice/events",
  createVoiceEventsHandler(prisma as never, {
    generator: createInsightGenerator(config.ai),
    generation: config.ai?.generation ?? "onDemand"
  })
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
