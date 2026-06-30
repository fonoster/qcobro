import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";

export interface WhatsAppWebhookConfig {
  appSecret?: string;
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

/**
 * Builds the GET and POST handlers for the Meta WhatsApp webhook endpoint.
 *
 * GET  /api/whatsapp/webhook — verify-token handshake (Meta subscribe flow):
 *   Meta sends `hub.mode`, `hub.verify_token`, `hub.challenge`. We look up the
 *   workspace that registered that verify_token, confirm `hub.mode=subscribe`, and
 *   echo back `hub.challenge` as plain text. 403 if the token is unknown.
 *
 * POST /api/whatsapp/webhook — signed event delivery:
 *   Validates the `X-Hub-Signature-256` header (when `appSecret` is configured).
 *   Returns 200 `EVENT_RECEIVED` immediately — downstream processing (§7.2+) will
 *   be wired here once the inbound-event handler is built.
 */
export function createWhatsAppWebhookHandlers(prisma: PrismaClient, cfg: WhatsAppWebhookConfig) {
  const db = prisma as unknown as {
    whatsAppIntegration: {
      findFirst(args: { where: { verifyToken: string } }): Promise<{ workspaceRef: string } | null>;
    };
  };

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

    // Acknowledge immediately (Meta requires a 200 within 20 s; processing is §7.2+).
    res.status(200).send("EVENT_RECEIVED");

    // TODO §7.2 — resolve workspace/sender by phoneNumberId, process customer messages,
    // opt-out signals, and quality-rating callbacks.
    console.log("[whatsapp/webhook] event received:", JSON.stringify(req.body));
  }

  return { verify, events };
}
