import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { getLogger } from "@fonoster/logger";
import {
  buildOutreachContext,
  normalizePhoneE164,
  whatsAppWebhookSchema,
  type AiConfig,
  type PortfolioAccountRecord,
  type WhatsAppClient
} from "@qcobro/common";
import type { ProviderEventRecorder } from "../engine/eventSink.js";
import {
  createIngestWhatsAppMessage,
  type WhatsAppGestionView,
  type WhatsAppInboundClient
} from "../functions/whatsApp/ingestWhatsAppMessage.js";
import { createRecordOutcome } from "../functions/campaigns/recordOutcome.js";
import { createWhatsAppAutopilot } from "../services/whatsAppAutopilot.js";

const logger = getLogger({ service: "whatsapp", filePath: import.meta.url });

export interface WhatsAppWebhookConfig {
  appSecret?: string;
  ai?: AiConfig;
  maxRepliesDefault?: number;
  resolveWhatsApp?: (
    workspaceRef: string,
    phoneNumberId: string
  ) => Promise<{ client: WhatsAppClient; languageCode: string } | null>;
  /** Flight recorder; statuses and inbound messages are recorded best-effort. */
  recordEvent?: ProviderEventRecorder | null;
}

/**
 * Scoped DB surface for the webhook handler. The full PrismaClient is passed in but
 * cast to this narrower type to keep the handler's dependencies explicit and testable.
 */
interface WebhookDb {
  whatsAppIntegration: {
    findFirst(args: { where: { verifyToken: string } }): Promise<{ workspaceRef: string } | null>;
  };
  whatsAppSenderNumber: {
    findUnique(args: {
      where: { phoneNumberId: string };
    }): Promise<{ workspaceRef: string } | null>;
    update(args: {
      where: { phoneNumberId: string };
      data: { qualityRating: string };
    }): Promise<unknown>;
  };
  accountContactLog: {
    findFirst(args: {
      where: { providerRef: string };
    }): Promise<{ id: string; portfolioAccountId: string } | null>;
  };
  portfolioAccount: {
    update(args: { where: { id: string }; data: { intentStatus: string } }): Promise<unknown>;
  };
}

/**
 * Verify the `X-Hub-Signature-256` Meta signs on every webhook POST.
 * Computes HMAC-SHA256 of the raw body with the app secret and compares
 * timing-safely against the header value (`sha256=<hex>`).
 */
function verifyMetaSignature(req: Request, appSecret: string): boolean {
  const sigHeader = req.headers["x-hub-signature-256"];
  if (!sigHeader || typeof sigHeader !== "string") return false;

  const stored = (req as { rawBody?: unknown }).rawBody;
  const rawBody: string = typeof stored === "string" ? stored : JSON.stringify(req.body ?? {});

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const expectedBuf = Buffer.from(`sha256=${expected}`);
  const receivedBuf = Buffer.from(sigHeader);

  if (receivedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(receivedBuf, expectedBuf);
}

/** Meta error code indicating the recipient has opted out / blocked the WABA. */
const OPT_OUT_ERROR_CODES = new Set([131050]);

type StatusRecord = {
  id: string;
  status: string;
  errors?: Array<{ code?: number; title?: string }>;
};

function isOptOut(status: StatusRecord): boolean {
  return (
    status.status === "failed" &&
    (status.errors ?? []).some((e) => e.code !== undefined && OPT_OUT_ERROR_CODES.has(e.code))
  );
}

/**
 * Build the Prisma-backed {@link WhatsAppInboundClient} used by the ingest function.
 * Loads the gestión by correlating via `phoneNumberId + customerPhone` (the most recent
 * WHATSAPP gestión our sender dispatched to that number).
 */
function createPrismaWhatsAppInboundClient(prisma: PrismaClient): WhatsAppInboundClient {
  return {
    async loadByPhoneAndSender(
      phoneNumberId: string,
      customerPhone: string
    ): Promise<WhatsAppGestionView | null> {
      // First resolve the sender number to its workspace.
      const sender = await prisma.whatsAppSenderNumber.findUnique({
        where: { phoneNumberId }
      });
      if (!sender) return null;

      // Find the most recent WHATSAPP gestión for this workspace dispatched to that phone.
      // Matched on E.164 (see normalizePhoneE164) — Meta's `channelData.path` equality
      // can't normalize server-side, so we compare over a recent, bounded window.
      //
      // Scoped via portfolioAccount.portfolio.workspaceRef, not campaign.workspaceRef:
      // manual/ad-hoc outreach (see outreachRouter.dispatch) records a campaign-less
      // gestión, and Prisma's nested filter on an optional relation drops rows where
      // that relation is null — campaign.workspaceRef would silently exclude every
      // manually-dispatched gestión from the candidate set.
      const normalizedCustomer = normalizePhoneE164(customerPhone);
      const candidates = await prisma.accountContactLog.findMany({
        where: {
          agentType: "WHATSAPP",
          portfolioAccount: { portfolio: { workspaceRef: sender.workspaceRef } }
        },
        include: {
          campaign: {
            include: {
              agentTemplate: { include: { whatsAppConfig: true } },
              whatsAppSenderNumber: { select: { phoneNumberId: true } }
            }
          },
          portfolioAccount: {
            include: { portfolio: true }
          }
        },
        orderBy: { contactedAt: "desc" },
        take: 50
      });
      const log =
        normalizedCustomer &&
        candidates.find((c) => {
          const to = (c.channelData as Record<string, unknown> | null)?.to;
          return typeof to === "string" && normalizePhoneE164(to) === normalizedCustomer;
        });
      if (!log || !log.portfolioAccount.phone) return null;

      // Campaign dispatches resolve the template via campaign.agentTemplate; manual/ad-hoc
      // outreach has no campaign and stores its template directly on the gestión instead.
      const manualTemplate = log.campaign
        ? null
        : log.agentTemplateId
          ? await prisma.agentTemplate.findUnique({
              where: { id: log.agentTemplateId },
              include: { whatsAppConfig: true }
            })
          : null;
      const whatsAppCfg =
        log.campaign?.agentTemplate?.whatsAppConfig ?? manualTemplate?.whatsAppConfig ?? null;
      const settings = await prisma.workspaceSettings.findUnique({
        where: { workspaceRef: sender.workspaceRef }
      });
      return {
        id: log.id,
        portfolioAccountId: log.portfolioAccountId,
        campaignId: log.campaignId,
        debtAmountSnapshot: log.debtAmountSnapshot,
        customerPhone,
        workspaceRef: sender.workspaceRef,
        phoneNumberId: log.campaign?.whatsAppSenderNumber?.phoneNumberId ?? phoneNumberId,
        providerRef: log.providerRef,
        channelData: (log.channelData as Record<string, unknown> | null) ?? null,
        agentSystemPrompt: whatsAppCfg?.systemPrompt ?? "",
        agentMaxReplies: whatsAppCfg?.maxReplies ?? null,
        accountContext: buildOutreachContext(
          log.portfolioAccount as unknown as PortfolioAccountRecord,
          { currency: settings?.currency ?? "USD" }
        )
      };
    },

    async updateChannelData(id: string, channelData: Record<string, unknown>): Promise<void> {
      await prisma.accountContactLog.update({
        where: { id },
        data: { channelData: channelData as never }
      });
    }
  };
}

/**
 * Process a parsed Meta webhook body: quality-rating updates, opt-out mapping, and
 * inbound customer message routing through the WhatsApp AI-reply autopilot.
 *
 * Runs after the 200 response is sent — Meta requires acknowledgement within 20 s.
 * Individual event errors are caught and logged; one bad event never blocks the rest.
 */
async function processEvents(
  body: ReturnType<typeof whatsAppWebhookSchema.parse>,
  db: WebhookDb,
  ingest: ReturnType<typeof createIngestWhatsAppMessage>,
  recordEvent?: ProviderEventRecorder
) {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const field = change.field;
      const value = change.value;
      if (!value) continue;

      try {
        // Quality-rating callback: field="quality_rating", phone_number_id and
        // new_quality_rating are at the value root (not under metadata).
        if (field === "quality_rating") {
          const phoneNumberId = value.phone_number_id;
          const rating = value.new_quality_rating;
          if (phoneNumberId && rating) {
            await db.whatsAppSenderNumber.update({
              where: { phoneNumberId },
              data: { qualityRating: rating }
            });
            logger.verbose(
              `quality rating updated phoneNumberId=${phoneNumberId} rating=${rating}`
            );
          }
          continue;
        }

        // Message-change events resolve via metadata.phone_number_id.
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // Opt-out signals: a failed delivery status with error code 131050.
        for (const status of value.statuses ?? []) {
          recordEvent?.({
            providerRef: status.id,
            providerAt: status.timestamp
              ? new Date(Number(status.timestamp) * 1000).toISOString()
              : undefined,
            summary: { status: status.status ?? "unknown", optOut: isOptOut(status) }
          });
          if (!isOptOut(status)) continue;
          const log = await db.accountContactLog.findFirst({
            where: { providerRef: status.id }
          });
          if (!log) {
            logger.warn(`opt-out: no gestión for providerRef=${status.id} — skipping`);
            continue;
          }
          await db.portfolioAccount.update({
            where: { id: log.portfolioAccountId },
            data: { intentStatus: "OPT_OUT" }
          });
          logger.verbose(`opt-out: account=${log.portfolioAccountId} providerRef=${status.id}`);
        }

        // Inbound customer messages — route through the AI-reply autopilot.
        for (const msg of value.messages ?? []) {
          const text = msg.text?.body ?? "";
          const result = await ingest({
            from: msg.from,
            metaMessageId: msg.id,
            timestamp: msg.timestamp,
            text,
            phoneNumberId
          });
          recordEvent?.({
            // The matched gestión's providerRef lets the recorder attribute the
            // event to a workspace; without it the row is invisible to every fetch.
            providerRef: result.matched ? result.providerRef : undefined,
            providerAt: msg.timestamp
              ? new Date(Number(msg.timestamp) * 1000).toISOString()
              : undefined,
            matched: result.matched,
            summary: { type: "inbound_message" }
          });
          if (result.matched) {
            logger.verbose(
              `inbound message: from=${msg.from} id=${msg.id} action=${result.action}`
            );
          } else {
            logger.verbose(`inbound message: from=${msg.from} id=${msg.id} — no gestión match`);
          }
        }
      } catch (err) {
        // Winston (this logger's backend) silently drops a plain-string second argument —
        // only an Error instance (message + stack) or a plain object render. Passing
        // `err.message` here used to log an empty `{}` on every failure.
        logger.error(
          `error processing change field=${field}:`,
          err instanceof Error ? err : { err: String(err) }
        );
      }
    }
  }
}

/**
 * Builds the GET and POST handlers for the Meta WhatsApp webhook endpoint.
 *
 * GET  /api/whatsapp/webhook — verify-token handshake (Meta subscribe flow):
 *   Meta sends `hub.mode`, `hub.verify_token`, `hub.challenge`. We look up the
 *   workspace that registered that verify_token, confirm `hub.mode=subscribe`, and
 *   echo back `hub.challenge` as plain text. 403 if the token is unknown.
 *
 * POST /api/whatsapp/webhook — signed event delivery:
 *   Validates the `X-Hub-Signature-256` header (when `appSecret` is configured),
 *   acknowledges immediately (Meta requires a 200 within 20 s), then processes:
 *   - quality_rating changes → update `WhatsAppSenderNumber.qualityRating`
 *   - failed-delivery statuses with error 131050 → mark account `OPT_OUT`
 *   - inbound customer messages → AI-reply autopilot (§7.3/§7.4)
 */
export function createWhatsAppWebhookHandlers(prisma: PrismaClient, cfg: WhatsAppWebhookConfig) {
  const db = prisma as unknown as WebhookDb;

  const autopilot = createWhatsAppAutopilot(cfg.ai);
  const recordOutcome = createRecordOutcome(prisma as never);
  const inboundClient = createPrismaWhatsAppInboundClient(prisma);
  const ingest = createIngestWhatsAppMessage({
    client: inboundClient,
    autopilot,
    recordOutcome,
    getWhatsAppClient: cfg.resolveWhatsApp
      ? async (workspaceRef, phoneNumberId) => {
          const resolved = await cfg.resolveWhatsApp!(workspaceRef, phoneNumberId);
          return resolved?.client ?? null;
        }
      : async () => null,
    maxRepliesDefault: cfg.maxRepliesDefault ?? 3,
    now: () => new Date()
  });

  async function verify(req: Request, res: Response): Promise<void> {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode !== "subscribe" || typeof token !== "string" || typeof challenge !== "string") {
      res.status(400).json({ error: "Invalid webhook verification request" });
      return;
    }

    const integration = await db.whatsAppIntegration.findFirst({
      where: { verifyToken: token }
    });
    if (!integration) {
      logger.warn("verify_token not found:", token);
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    logger.verbose(`verified workspace=${integration.workspaceRef} challenge=${challenge}`);
    res.status(200).send(challenge);
  }

  async function events(req: Request, res: Response): Promise<void> {
    if (cfg.appSecret) {
      if (!verifyMetaSignature(req, cfg.appSecret)) {
        logger.warn("invalid signature — request rejected");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    } else {
      logger.warn("appSecret not configured — skipping signature verification");
    }

    // Acknowledge immediately — Meta requires a 200 within 20 s.
    res.status(200).send("EVENT_RECEIVED");

    const parsed = whatsAppWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn("malformed body:", parsed.error.message);
      return;
    }

    // Fire-and-forget after the ack; errors are caught inside processEvents.
    processEvents(parsed.data, db, ingest, cfg.recordEvent ?? undefined).catch((err) =>
      logger.error("processEvents threw:", err)
    );
  }

  return { verify, events };
}
