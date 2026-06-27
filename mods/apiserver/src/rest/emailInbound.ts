import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import {
  buildOutreachContext,
  ValidationError,
  type AiConfig,
  type PortfolioAccountRecord,
  type ResendConfig
} from "@qcobro/common";
import {
  createIngestEmailReply,
  type EmailGestionView,
  type EmailInboundClient
} from "../functions/email/ingestEmailReply.js";
import { createRecordOutcome } from "../functions/campaigns/recordOutcome.js";
import { createEmailAutopilot } from "../services/emailAutopilot.js";
import { ResendEmailClient } from "../services/resendEmailClient.js";

/** Prisma-backed {@link EmailInboundClient}: load the gestión + email agent config by token. */
export function createPrismaEmailInboundClient(prisma: PrismaClient): EmailInboundClient {
  return {
    async loadByProviderRef(token: string): Promise<EmailGestionView | null> {
      const log = await prisma.accountContactLog.findFirst({
        where: { providerRef: token },
        include: {
          campaign: { include: { agentTemplate: { include: { emailConfig: true } } } },
          portfolioAccount: { include: { portfolio: true } }
        }
      });
      if (!log || !log.portfolioAccount.email) return null;
      const email = log.campaign?.agentTemplate?.emailConfig ?? null;
      return {
        id: log.id,
        portfolioAccountId: log.portfolioAccountId,
        campaignId: log.campaignId,
        debtAmountSnapshot: log.debtAmountSnapshot,
        customerEmail: log.portfolioAccount.email,
        channelData: (log.channelData as Record<string, unknown> | null) ?? null,
        agentSystemPrompt: email?.systemPrompt ?? "",
        agentMaxReplies: email?.maxReplies ?? null,
        accountContext: buildOutreachContext(
          log.portfolioAccount as unknown as PortfolioAccountRecord,
          log.portfolioAccount.portfolio
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

function addr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "address" in v)
    return String((v as { address: unknown }).address);
  return "";
}

/** Normalise Resend's headers field — either a Record or an array of {name,value} objects. */
function normalizeHeaders(raw: unknown): Record<string, string> | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    return Object.fromEntries(
      raw
        .filter(
          (h): h is { name: string; value: string } =>
            h && typeof h === "object" && "name" in h && "value" in h
        )
        .map((h) => [h.name.toLowerCase(), h.value])
    );
  }
  if (typeof raw === "object") return raw as Record<string, string>;
  return undefined;
}

/** Map Resend's inbound payload (defensively) to the normalized inbound-email shape. */
function normalize(body: unknown): {
  from: string;
  to: string[];
  subject?: string;
  text: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
} {
  const root = (body ?? {}) as Record<string, unknown>;
  const d = (root.data ?? root) as Record<string, unknown>;
  const headers = normalizeHeaders(d.headers);
  const toRaw = d.to;
  return {
    from: addr(d.from),
    to: Array.isArray(toRaw) ? toRaw.map(addr) : toRaw ? [addr(toRaw)] : [],
    subject: typeof d.subject === "string" ? d.subject : undefined,
    text:
      typeof d.text === "string" && d.text
        ? d.text
        : typeof d.plain === "string" && d.plain
          ? d.plain
          : typeof d.html === "string"
            ? d.html
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
            : "",
    messageId:
      (d.message_id as string) ?? (d.messageId as string) ?? headers?.["message-id"] ?? undefined,
    inReplyTo: (d.in_reply_to as string) ?? headers?.["in-reply-to"] ?? undefined,
    references: Array.isArray(d.references) ? (d.references as string[]) : undefined,
    headers
  };
}

export interface EmailInboundDeps {
  resend: ResendConfig;
  ai: AiConfig;
}

/**
 * Verify a Svix-signed webhook (standard-webhooks spec used by Resend).
 * Secret format: `whsec_<base64>`. Signs `{svix-id}.{svix-timestamp}.{rawBody}` with
 * HMAC-SHA256 and compares against the `svix-signature` header (space-separated `v1,<b64>`
 * entries). Uses timing-safe comparison to prevent timing attacks.
 */
function verifySvixSignature(req: Request, secret: string): boolean {
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

/**
 * Builds the `POST /api/email/inbound` handler for Resend inbound replies. Verifies the
 * Svix HMAC-SHA256 signature (when `inboundSigningSecret` is configured), correlates the
 * reply to its gestión by the reply-to token, and runs the EMAIL autopilot. Inert (503)
 * when Resend is unconfigured.
 */
export function createEmailInboundHandler(prisma: PrismaClient, deps: EmailInboundDeps) {
  const resend = deps.resend;

  return async (req: Request, res: Response): Promise<void> => {
    if (!resend) {
      res.status(503).json({ error: "Email channel is not configured" });
      return;
    }
    if (resend.inboundSigningSecret) {
      if (!verifySvixSignature(req, resend.inboundSigningSecret)) {
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }
    }

    const ingest = createIngestEmailReply({
      client: createPrismaEmailInboundClient(prisma),
      autopilot: createEmailAutopilot(deps.ai),
      recordOutcome: createRecordOutcome(prisma as never),
      emailClient: new ResendEmailClient(resend),
      emailFrom: {
        email: resend.fromEmail,
        name: resend.fromName,
        inboundDomain: resend.inboundDomain
      },
      maxRepliesDefault: resend.maxRepliesDefault,
      now: () => new Date()
    });

    try {
      const normalized = normalize(req.body);

      // Ignore non-reply events (e.g. delivery notifications for outbound emails).
      // A real inbound reply will have our reply+<token>@<inboundDomain> in the `to` list.
      const isReply = normalized.to.some((t) => t.includes(`@${resend.inboundDomain}`));
      if (!isReply) {
        res.status(200).json({ ignored: true, reason: "not_a_reply" });
        return;
      }

      console.log("[email/inbound] reply received:", JSON.stringify(normalized));
      const result = await ingest(normalized);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ValidationError) {
        console.error("[email/inbound] 400:", JSON.stringify(err.toJSON()));
        res.status(400).json(err.toJSON());
        return;
      }
      console.error("[email/inbound] unexpected error:", err);
      res.status(500).json({ error: "Failed to ingest email reply" });
    }
  };
}
