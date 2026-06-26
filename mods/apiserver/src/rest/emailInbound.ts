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
  const headers = (d.headers as Record<string, string> | undefined) ?? undefined;
  const toRaw = d.to;
  return {
    from: addr(d.from),
    to: Array.isArray(toRaw) ? toRaw.map(addr) : toRaw ? [addr(toRaw)] : [],
    subject: typeof d.subject === "string" ? d.subject : undefined,
    text: typeof d.text === "string" ? d.text : typeof d.plain === "string" ? d.plain : "",
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
 * Builds the `POST /api/email/inbound` handler for Resend inbound replies. Verifies the
 * shared secret (when configured), correlates the reply to its gestión by the reply-to
 * token, and runs the EMAIL autopilot ({@link createIngestEmailReply}). Inert (503) when
 * Resend is unconfigured.
 *
 * NOTE(security): when `inboundSigningSecret` is set we require it on the `x-webhook-secret`
 * header. Full Svix HMAC verification of Resend's signed headers is a follow-up.
 */
export function createEmailInboundHandler(prisma: PrismaClient, deps: EmailInboundDeps) {
  const resend = deps.resend;

  return async (req: Request, res: Response): Promise<void> => {
    if (!resend) {
      res.status(503).json({ error: "Email channel is not configured" });
      return;
    }
    if (resend.inboundSigningSecret) {
      const provided = req.headers["x-webhook-secret"];
      if (provided !== resend.inboundSigningSecret) {
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
      const result = await ingest(normalize(req.body));
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json(err.toJSON());
        return;
      }
      res.status(500).json({ error: "Failed to ingest email reply" });
    }
  };
}
