import type { Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import {
  buildOutreachContext,
  parseLocale,
  ValidationError,
  type AiConfig,
  type EmailEventCallbackInput,
  type PortfolioAccountRecord,
  type ResendConfig
} from "@qcobro/common";
import { getLogger } from "@fonoster/logger";
import type { ProviderEventRecorder } from "../engine/eventSink.js";
import {
  createIngestEmailReply,
  extractToken,
  type EmailGestionView,
  type EmailInboundClient
} from "../functions/email/ingestEmailReply.js";
import { createRecordOutcome } from "../functions/campaigns/recordOutcome.js";
import {
  createPrismaEmailDeliveryStatusClient,
  createRecordEmailDeliveryStatus
} from "../functions/email/recordEmailDeliveryStatus.js";
import { createEmailAutopilot } from "../services/emailAutopilot.js";
import { ResendEmailClient } from "../services/resendEmailClient.js";
import { verifySvixSignature } from "./svixSignature.js";

const logger = getLogger({ service: "email", filePath: import.meta.url });

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
      // Currency is a workspace setting (default USD when unset).
      const settings = await prisma.workspaceSettings.findUnique({
        where: { workspaceRef: log.portfolioAccount.portfolio.workspaceRef }
      });
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
          { currency: settings?.currency ?? "USD", locale: parseLocale(settings?.locale) }
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

/** Strip tags + collapse whitespace from an HTML body into plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trim quoted reply history and the signature block so only the customer's new message
 * is kept. Cuts at the first quote/separator marker (Gmail/Apple "On … wrote:" / Spanish
 * "El … escribió:", Outlook header block, `>`-quoted lines, the `--` signature
 * delimiter). Falls back to the full text if stripping would leave nothing.
 */
export function stripQuotedReply(text: string): string {
  const lines = text.split(/\r?\n/);
  const markers = [
    /^\s*On .+ wrote:\s*$/i,
    /^\s*El .+ escribió:\s*$/i,
    /^\s*-{2,}\s*Original Message\s*-{2,}/i,
    /^\s*-{2,}\s*Mensaje original\s*-{2,}/i,
    /^\s*_{5,}\s*$/,
    /^\s*From:\s.+/i,
    /^\s*De:\s.+/i,
    /^\s*>/,
    /^\s*--\s*$/
  ];
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (markers.some((re) => re.test(lines[i]))) {
      end = i;
      break;
    }
  }
  const stripped = lines.slice(0, end).join("\n").trim();
  return stripped || text.trim();
}

/** Resend's event name for an inbound customer reply; everything else is about our own send. */
const INBOUND_EVENT = "email.received";

/**
 * Map Resend's outbound event envelope onto the normalized delivery-status input, defensively —
 * the payload is provider-shaped and versioned, so every field is probed rather than assumed.
 *
 * `data.email_id` is the send-time message id and the only correlation handle an outbound event
 * carries. The timestamp prefers the event-specific one (`data.open.timestamp` on an open) over
 * the envelope's `created_at`, so `openedAt` records the read rather than the webhook delivery.
 */
export function normalizeEmailEvent(body: unknown): EmailEventCallbackInput | null {
  const root = (body ?? {}) as Record<string, unknown>;
  const data = (root.data ?? {}) as Record<string, unknown>;

  const type = typeof root.type === "string" ? root.type : undefined;
  const rawId = data.email_id ?? data.emailId ?? data.id ?? root.email_id;
  const providerMessageId = typeof rawId === "string" ? rawId : undefined;
  if (!type || !providerMessageId) return null;

  const open = (data.open ?? {}) as Record<string, unknown>;
  const at =
    (typeof open.timestamp === "string" ? open.timestamp : undefined) ??
    (typeof root.created_at === "string" ? root.created_at : undefined) ??
    (typeof data.created_at === "string" ? data.created_at : undefined) ??
    new Date().toISOString();

  const bounce = (data.bounce ?? {}) as Record<string, unknown>;
  return {
    providerMessageId,
    type,
    at,
    bounceType: typeof bounce.type === "string" ? bounce.type : undefined,
    bounceSubType:
      (typeof bounce.subType === "string" ? bounce.subType : undefined) ??
      (typeof bounce.sub_type === "string" ? bounce.sub_type : undefined)
  };
}

/** Pull the received-email id out of the webhook payload (Resend `email.received`). */
function extractReceivedEmailId(body: unknown): string | null {
  const root = (body ?? {}) as Record<string, unknown>;
  const d = (root.data ?? root) as Record<string, unknown>;
  const id = d.email_id ?? d.emailId ?? d.id ?? root.email_id;
  return typeof id === "string" ? id : null;
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
            ? stripHtml(d.html)
            : "",
    messageId:
      (d.message_id as string) ?? (d.messageId as string) ?? headers?.["message-id"] ?? undefined,
    inReplyTo: (d.in_reply_to as string) ?? headers?.["in-reply-to"] ?? undefined,
    references: Array.isArray(d.references) ? (d.references as string[]) : undefined,
    headers
  };
}

/**
 * Ingest one Resend outbound event: correlate by message id, advance the delivery axis, and
 * record the flight-recorder entry. Always answers 200 once here — a redelivery of an event
 * that matched nothing cannot resolve differently, so acknowledging it stops Resend retrying
 * (same contract as `/api/sms/events`).
 */
async function handleDeliveryEvent(
  body: unknown,
  record: ReturnType<typeof createRecordEmailDeliveryStatus>,
  recordEvent: ProviderEventRecorder | null | undefined,
  res: Response
): Promise<void> {
  const event = normalizeEmailEvent(body);
  if (!event) {
    // Acknowledged, not rejected: an unparseable payload is a Resend-shape change or an event
    // kind with no email id, and neither resolves differently on redelivery.
    logger.warn("event carried no type or email_id — ignoring");
    res.status(200).json({ ignored: true, reason: "unrecognized_payload" });
    return;
  }

  logger.verbose(`event type=${event.type} emailId=${event.providerMessageId}`);
  const result = await record(event);
  res.status(200).json({ result: "success" });

  if (!result.matched) {
    logger.warn(`no gestión matched emailId=${event.providerMessageId} — event dropped`);
  }

  recordEvent?.({
    // Attribution runs through the matched gestión's providerRef; the Resend message id is
    // not a key the recorder can resolve a workspace from.
    providerRef: result.matched ? (result.providerRef ?? undefined) : undefined,
    providerAt: event.at,
    matched: result.matched,
    summary: { status: event.type }
  });
}

export interface EmailWebhookDeps {
  resend: ResendConfig;
  ai: AiConfig;
  /** Flight recorder; each event is recorded best-effort. */
  recordEvent?: ProviderEventRecorder | null;
}

/**
 * Builds the `POST /api/email/inbound` handler — the single Resend webhook, carrying both
 * directions. Verifies the Svix HMAC-SHA256 signature against `inboundSigningSecret`, then
 * routes on the event name:
 *
 *   `email.received`   a customer reply: correlate by reply-to token, run the EMAIL autopilot
 *   everything else    one of our own sends: correlate by message id, move the delivery axis
 *
 * One endpoint rather than two because Resend issues a signing secret per endpoint, and a
 * second endpoint would have bought a second secret, a second dashboard entry and a second
 * config key for a branch this small. The URL keeps saying `inbound` because that is the
 * direction of the *webhook* — the same sense in which `whatsAppWebhook` serves both inbound
 * messages and outbound delivery statuses — and because it is the URL already registered in
 * production. Inert (503) when Resend is unconfigured.
 */
export function createEmailWebhookHandler(prisma: PrismaClient, deps: EmailWebhookDeps) {
  const resend = deps.resend;
  const record = createRecordEmailDeliveryStatus(createPrismaEmailDeliveryStatusClient(prisma));

  // Surfaced once at boot rather than per request, so the reason is not something an operator
  // has to infer from a wall of 401s in the Resend dashboard.
  if (resend && !resend.inboundSigningSecret) {
    logger.warn(
      "resend.inboundSigningSecret is not set — /api/email/inbound will reject every request. " +
        "Add the signing secret from the Resend endpoint to enable reply and delivery ingestion."
    );
  }

  return async (req: Request, res: Response): Promise<void> => {
    if (!resend) {
      res.status(503).json({ error: "Email channel is not configured" });
      return;
    }
    // Fails closed. This endpoint mutates gestiones on both branches — the reply path writes
    // `entrega`, `camino` and an autopilot `resultado`; the delivery path writes `entrega` and
    // `deliveryReason` for any message id the caller supplies — so an unset secret must mean
    // "reject", not "trust anyone". Previously an absent secret skipped verification entirely.
    if (!resend.inboundSigningSecret) {
      res.status(401).json({ error: "Email webhook signing secret is not configured" });
      return;
    }
    if (!verifySvixSignature(req, resend.inboundSigningSecret)) {
      logger.warn("rejected request with invalid or missing svix-signature");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    const emailClient = new ResendEmailClient(resend);
    const ingest = createIngestEmailReply({
      client: createPrismaEmailInboundClient(prisma),
      autopilot: createEmailAutopilot(deps.ai),
      recordOutcome: createRecordOutcome(prisma as never),
      emailClient,
      emailFrom: {
        email: resend.fromEmail,
        name: resend.fromName,
        inboundDomain: resend.inboundDomain
      },
      maxRepliesDefault: resend.maxRepliesDefault,
      now: () => new Date()
    });

    try {
      // Outbound delivery/open/bounce events take the short path: correlate by the Resend
      // message id and move the delivery axis. Branching on the event name rather than the
      // recipient keeps the reply detection below exactly as it was — an unknown or absent
      // `type` still falls through to it.
      const eventType =
        typeof (req.body as { type?: unknown })?.type === "string"
          ? (req.body as { type: string }).type
          : undefined;
      if (eventType && eventType !== INBOUND_EVENT) {
        await handleDeliveryEvent(req.body, record, deps.recordEvent, res);
        return;
      }

      const normalized = normalize(req.body);

      // A real inbound reply will have our reply+<token>@<inboundDomain> in the `to` list.
      // Anything else reaching here has no `type` to route on and no reply-to token to
      // correlate by, so there is nothing to do with it.
      const isReply = normalized.to.some((t) => t.includes(`@${resend.inboundDomain}`));
      if (!isReply) {
        res.status(200).json({ ignored: true, reason: "not_a_reply" });
        return;
      }

      // Resend's `email.received` webhook is metadata-only — no body. When the payload
      // carries no text, hydrate it from the Received Emails API by email id before
      // ingesting, so the customer's actual reply is captured (not an empty message).
      if (!normalized.text) {
        const emailId = extractReceivedEmailId(req.body);
        if (emailId && emailClient.getReceivedEmail) {
          const full = await emailClient.getReceivedEmail(emailId);
          if (full) {
            normalized.text =
              (full.text && full.text.trim()) || (full.html ? stripHtml(full.html) : "");
            if (!normalized.subject && full.subject) normalized.subject = full.subject;
            if (!normalized.messageId && full.messageId) normalized.messageId = full.messageId;
            if (!normalized.from && full.from) normalized.from = full.from;
          }
        }
      }

      // Keep only the customer's new message — drop quoted history + signature.
      if (normalized.text) normalized.text = stripQuotedReply(normalized.text);

      logger.verbose("reply received:", JSON.stringify(normalized));
      const result = await ingest(normalized);
      res.status(200).json(result);

      // Same token extraction the correlation path uses — a diverging regex here
      // would record matched events with no attributable providerRef.
      deps.recordEvent?.({
        providerRef: extractToken(normalized.to) ?? undefined,
        matched: result.matched,
        summary: { type: "inbound_reply" }
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        logger.error("400:", JSON.stringify(err.toJSON()));
        res.status(400).json(err.toJSON());
        return;
      }
      logger.error("unexpected error:", err);
      res.status(500).json({ error: "Failed to ingest email reply" });
    }
  };
}
