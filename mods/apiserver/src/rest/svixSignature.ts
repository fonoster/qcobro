import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

/**
 * Verify a Svix-signed webhook (standard-webhooks spec used by Resend).
 * Secret format: `whsec_<base64>`. Signs `{svix-id}.{svix-timestamp}.{rawBody}` with
 * HMAC-SHA256 and compares against the `svix-signature` header (space-separated `v1,<b64>`
 * entries). Uses timing-safe comparison to prevent timing attacks.
 *
 * Shared by both Resend endpoints — `/api/email/inbound` (customer replies) and
 * `/api/email/events` (outbound delivery/open events). Resend issues a separate signing
 * secret per endpoint, so each caller passes its own.
 */
export function verifySvixSignature(req: Request, secret: string): boolean {
  const msgId = req.headers["svix-id"];
  const msgTs = req.headers["svix-timestamp"];
  const sigHeader = req.headers["svix-signature"];
  if (!msgId || !msgTs || !sigHeader) return false;

  const stored = (req as { rawBody?: unknown }).rawBody;
  const rawBody: string = typeof stored === "string" ? stored : JSON.stringify(req.body);

  const keyBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const toSign = `${msgId}.${msgTs}.${rawBody}`;
  const expected = createHmac("sha256", keyBytes).update(toSign).digest("base64");

  const expectedBuf = Buffer.from(expected);
  const signatures = String(sigHeader).split(" ");
  return signatures.some((sig) => {
    const b64 = sig.startsWith("v1,") ? sig.slice(3) : sig;
    const candidate = Buffer.from(b64);
    if (candidate.length !== expectedBuf.length) return false;
    return timingSafeEqual(candidate, expectedBuf);
  });
}
