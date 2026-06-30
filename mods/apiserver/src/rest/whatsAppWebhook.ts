import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { whatsAppWebhookSchema } from "@qcobro/common";

export interface WhatsAppWebhookConfig {
  appSecret?: string;
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
 * Process a parsed Meta webhook body: quality-rating updates, opt-out mapping, and
 * (§7.3) inbound customer message routing.
 *
 * Runs after the 200 response is sent — Meta requires acknowledgement within 20 s.
 * Individual event errors are caught and logged; one bad event never blocks the rest.
 */
async function processEvents(body: ReturnType<typeof whatsAppWebhookSchema.parse>, db: WebhookDb) {
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
            console.log(
              `[whatsapp/webhook] quality rating updated phoneNumberId=${phoneNumberId} rating=${rating}`
            );
          }
          continue;
        }

        // Message-change events resolve via metadata.phone_number_id.
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        // Opt-out signals: a failed delivery status with error code 131050.
        // Walk each status; find the dispatched gestión by the Meta message id (providerRef)
        // then mark the account OPT_OUT so it is suppressed across all future campaigns.
        for (const status of value.statuses ?? []) {
          if (!isOptOut(status)) continue;
          const log = await db.accountContactLog.findFirst({
            where: { providerRef: status.id }
          });
          if (!log) {
            console.warn(
              `[whatsapp/webhook] opt-out: no gestión for providerRef=${status.id} — skipping`
            );
            continue;
          }
          await db.portfolioAccount.update({
            where: { id: log.portfolioAccountId },
            data: { intentStatus: "OPT_OUT" }
          });
          console.log(
            `[whatsapp/webhook] opt-out: account=${log.portfolioAccountId} providerRef=${status.id}`
          );
        }

        // Inbound customer messages — §7.3 (AI-reply autopilot).
        for (const msg of value.messages ?? []) {
          console.log(
            `[whatsapp/webhook] inbound message (§7.3): from=${msg.from} id=${msg.id} phoneNumberId=${phoneNumberId}`
          );
        }
      } catch (err) {
        console.error(
          `[whatsapp/webhook] error processing change field=${field}:`,
          err instanceof Error ? err.message : err
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
 *   - inbound customer messages → §7.3 AI-reply autopilot (stub)
 */
export function createWhatsAppWebhookHandlers(prisma: PrismaClient, cfg: WhatsAppWebhookConfig) {
  const db = prisma as unknown as WebhookDb;

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
      console.warn("[whatsapp/webhook] verify_token not found:", token);
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    console.log(
      `[whatsapp/webhook] verified workspace=${integration.workspaceRef} challenge=${challenge}`
    );
    res.status(200).send(challenge);
  }

  async function events(req: Request, res: Response): Promise<void> {
    if (cfg.appSecret) {
      if (!verifyMetaSignature(req, cfg.appSecret)) {
        console.warn("[whatsapp/webhook] invalid signature — request rejected");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    } else {
      console.warn("[whatsapp/webhook] appSecret not configured — skipping signature verification");
    }

    // Acknowledge immediately — Meta requires a 200 within 20 s.
    res.status(200).send("EVENT_RECEIVED");

    const parsed = whatsAppWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      console.warn("[whatsapp/webhook] malformed body:", parsed.error.message);
      return;
    }

    // Fire-and-forget after the ack; errors are caught inside processEvents.
    processEvents(parsed.data, db).catch((err) =>
      console.error("[whatsapp/webhook] processEvents threw:", err)
    );
  }

  return { verify, events };
}
