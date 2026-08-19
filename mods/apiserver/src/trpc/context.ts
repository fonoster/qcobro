import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import type {
  EmailClient,
  Locale,
  OutboundCallClient,
  SmsClient,
  VoiceApplicationClient,
  VoiceCallStatusTracker
} from "@qcobro/common";
import { DEFAULT_LOCALE, parseLocale } from "@qcobro/common";

import { prisma } from "../db.js";
import { createIdentityClient } from "@fonoster/identity-client";
import { FonosterVoiceApplicationClient } from "../services/fonosterVoiceApplicationClient.js";
import { FonosterOutboundCallClient } from "../services/fonosterOutboundCallClient.js";
import { TwilioSmsClient } from "../services/twilioSmsClient.js";
import { createStripeGateway } from "../services/stripeGateway.js";
import { ResendEmailClient } from "../services/resendEmailClient.js";
import { createInsightGenerator } from "../services/insightGenerator.js";
import { createEmailAutopilot } from "../services/emailAutopilot.js";
import { createWhatsAppAutopilot } from "../services/whatsAppAutopilot.js";
import { createGetWorkspaceSettings } from "../functions/workspaceSettings/getWorkspaceSettings.js";
import { config } from "../config.js";

/**
 * The per-workspace settings every procedure reads off the context. `locale` rides along with
 * `currency` so no call site has to fetch settings ad hoc just to format an amount.
 */
type WorkspaceRuntimeSettings = {
  timezone: string;
  currency: "USD" | "DOP";
  locale: Locale;
};

export interface AuthedUser {
  ref: string;
  accessKeyId: string;
}

export interface ActiveWorkspace {
  accessKeyId: string;
  role: string;
}

// Header carrying the workspace the client wants to act in (an accessKeyId the
// caller must be a member of).
const WORKSPACE_HEADER = "x-workspace";

// Shared singletons reached by procedures through the context.
const identity = createIdentityClient(config.identity.endpoint);

// Voice-application sync is optional: only wired when Fonoster is configured.
// When absent, voice templates save locally and stay unsynced until configured.
const voiceApplications: VoiceApplicationClient | null = config.fonoster
  ? new FonosterVoiceApplicationClient(config.fonoster)
  : null;

// Outreach dispatch clients + sending-number pools, each gated on their provider
// config. When a provider is absent, dispatch for that channel fails with a clear
// error (mirroring the voice-template "saves locally when Fonoster absent" posture).
// One instance implements both OutboundCallClient and VoiceCallStatusTracker — shared so
// manual/ad-hoc voice dispatch's call-status tracking reuses the same authenticated
// Fonoster client/login as call origination (see voice-call-status-tracking).
const fonosterCallClient = config.fonoster ? new FonosterOutboundCallClient(config.fonoster) : null;
const outboundCallClient: OutboundCallClient | null = fonosterCallClient;
const voiceCallStatusTracker: VoiceCallStatusTracker | null = fonosterCallClient;
const smsClient: SmsClient | null = config.twilio ? new TwilioSmsClient(config.twilio) : null;
const emailClient: EmailClient | null = config.resend ? new ResendEmailClient(config.resend) : null;
const fonosterNumbers = config.fonoster?.numbers ?? [];
const twilioFromNumbers = config.twilio?.fromNumbers ?? [];
// Sending identity + inbound domain for email; null when Resend is unconfigured.
const emailFrom = config.resend
  ? {
      email: config.resend.fromEmail,
      name: config.resend.fromName,
      inboundDomain: config.resend.inboundDomain
    }
  : null;
// Shared EXTERNAL app ref for all pre-recorded voice dispatch (points at the
// embedded VoiceServer). Voz IA uses each template's own AUTOPILOT ref instead.
const fonosterPrerecordedAppRef = config.fonoster?.prerecordedAppRef ?? null;

// Stripe gateway (billing) — built once like the channel clients above, reached
// by procedures through ctx (never constructed inside a router).
const stripeGateway = createStripeGateway(config.billing);

// AI-insight generator, gated on the `ai` config. Null when absent/disabled — the
// generate-insight path then no-ops (gestiones stay unanalyzed).
const insightGenerator = createInsightGenerator(config.ai);

// agent-evaluations capability: the same autopilot deciders EMAIL/WHATSAPP dispatch uses,
// reused (not reimplemented) to drive `agentEvaluations.evaluate`'s scripted turns. Their
// deployment-default reply caps mirror the live ingestion paths exactly (resend for EMAIL,
// whatsapp for WHATSAPP).
const emailAutopilot = createEmailAutopilot(config.ai);
const whatsAppAutopilot = createWhatsAppAutopilot(config.ai);
const emailMaxRepliesDefault = config.resend?.maxRepliesDefault ?? 3;
const whatsAppMaxRepliesDefault = config.whatsapp?.maxRepliesDefault ?? 3;

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Resolves the authenticated principal (and, when a workspace is both requested and
 * the principal belongs to it, the active workspace) from a bearer token + requested
 * workspace accessKeyId. Shared by both the HTTP context (reads these from headers)
 * and the WebSocket context (reads these from the connection's `connectionParams`,
 * since browsers cannot set custom headers on a WebSocket handshake) so the two
 * transports can never resolve auth differently.
 */
async function resolveAuth(
  token: string | null,
  requestedWorkspace: string | null
): Promise<{ user: AuthedUser | null; workspace: ActiveWorkspace | null }> {
  if (!token) return { user: null, workspace: null };

  const claims = await identity.verifyToken(token);
  if (!claims) return { user: null, workspace: null };

  const user: AuthedUser = { ref: claims.sub, accessKeyId: claims.accessKeyId };
  let workspace: ActiveWorkspace | null = null;
  if (requestedWorkspace) {
    const match = claims.access.find((a) => a.accessKeyId === requestedWorkspace);
    if (match) {
      workspace = { accessKeyId: match.accessKeyId, role: match.role };
    }
  }
  return { user, workspace };
}

/** Per-workspace timezone, currency + locale, seeded (via column defaults) on first use. The
 * defaults below are only used when no workspace is active (e.g. auth routes), where
 * none of the values are consumed. */
async function resolveWorkspaceSettings(
  workspace: ActiveWorkspace | null
): Promise<WorkspaceRuntimeSettings> {
  if (!workspace) {
    return { timezone: "America/Costa_Rica", currency: "USD", locale: DEFAULT_LOCALE };
  }
  const settings = await createGetWorkspaceSettings(prisma as never)(workspace.accessKeyId);
  return {
    timezone: settings.timezone,
    currency: settings.currency,
    locale: parseLocale(settings.locale)
  };
}

/** The service singletons + resolved auth every context (HTTP or WS) exposes to procedures. */
function assembleContext(
  token: string | null,
  user: AuthedUser | null,
  workspace: ActiveWorkspace | null,
  settings: WorkspaceRuntimeSettings
) {
  return {
    token,
    user,
    workspace,
    prisma,
    identity,
    voiceApplications,
    outboundCallClient,
    voiceCallStatusTracker,
    smsClient,
    emailClient,
    emailFrom,
    fonosterNumbers,
    twilioFromNumbers,
    fonosterPrerecordedAppRef,
    stripeGateway,
    insightGenerator,
    emailAutopilot,
    whatsAppAutopilot,
    emailMaxRepliesDefault,
    whatsAppMaxRepliesDefault,
    aiGeneration: config.ai?.generation ?? "onDemand",
    timezone: settings.timezone,
    currency: settings.currency,
    locale: settings.locale
  };
}

/**
 * Builds the per-request tRPC context for the HTTP (`/trpc`) transport.
 *
 * Procedures reach shared services (Prisma, the Identity client) through here.
 * When the request carries a valid Identity access token, the authenticated
 * principal is resolved: the user, and — if a valid workspace header is present
 * and the user belongs to it — the active workspace and the caller's role there.
 */
export async function createContext(opts: CreateExpressContextOptions) {
  const token = opts.req.headers.authorization?.replace("Bearer ", "") ?? null;
  const requestedWorkspace = headerValue(opts.req.headers[WORKSPACE_HEADER]);
  const { user, workspace } = await resolveAuth(token, requestedWorkspace);
  const settings = await resolveWorkspaceSettings(workspace);
  return assembleContext(token, user, workspace, settings);
}

/**
 * Builds the per-connection tRPC context for the WebSocket (`/trpc-ws`) transport used by
 * subscriptions (realtime-streaming capability). Browsers cannot set custom headers on a
 * WebSocket handshake, so the token and active-workspace accessKeyId travel as
 * `connectionParams` — sent by the client's `wsLink`/`createWSClient` as the connection's
 * first message — instead of the `Authorization`/`x-workspace` headers the HTTP path reads.
 * Resolution otherwise matches {@link createContext} exactly via the shared helpers above.
 */
export async function createWSContext(opts: CreateWSSContextFnOptions) {
  const params = opts.info.connectionParams;
  const token = params?.token ?? null;
  const requestedWorkspace = params?.workspace ?? null;
  const { user, workspace } = await resolveAuth(token, requestedWorkspace);
  const settings = await resolveWorkspaceSettings(workspace);
  return assembleContext(token, user, workspace, settings);
}

export type Context = Awaited<ReturnType<typeof createContext>>;
