import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { OutboundCallClient, SmsClient, VoiceApplicationClient } from "@qcobro/common";
import { prisma } from "../db.js";
import { createIdentityClient } from "@fonoster/identity-client";
import { FonosterVoiceApplicationClient } from "../services/fonosterVoiceApplicationClient.js";
import { FonosterOutboundCallClient } from "../services/fonosterOutboundCallClient.js";
import { TwilioSmsClient } from "../services/twilioSmsClient.js";
import { createInsightGenerator } from "../services/insightGenerator.js";
import { config } from "../config.js";

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
const outboundCallClient: OutboundCallClient | null = config.fonoster
  ? new FonosterOutboundCallClient(config.fonoster)
  : null;
const smsClient: SmsClient | null = config.twilio ? new TwilioSmsClient(config.twilio) : null;
const fonosterNumbers = config.fonoster?.numbers ?? [];
const twilioFromNumbers = config.twilio?.fromNumbers ?? [];
// Shared EXTERNAL app ref for all pre-recorded voice dispatch (points at the
// embedded VoiceServer). Voz IA uses each template's own AUTOPILOT ref instead.
const fonosterPrerecordedAppRef = config.fonoster?.prerecordedAppRef ?? null;

// AI-insight generator, gated on the `ai` config. Null when absent/disabled — the
// generate-insight path then no-ops (gestiones stay unanalyzed).
const insightGenerator = createInsightGenerator(config.ai);

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Builds the per-request tRPC context.
 *
 * Procedures reach shared services (Prisma, the Identity client) through here.
 * When the request carries a valid Identity access token, the authenticated
 * principal is resolved: the user, and — if a valid workspace header is present
 * and the user belongs to it — the active workspace and the caller's role there.
 */
export async function createContext(opts: CreateExpressContextOptions) {
  const token = opts.req.headers.authorization?.replace("Bearer ", "") ?? null;

  let user: AuthedUser | null = null;
  let workspace: ActiveWorkspace | null = null;

  if (token) {
    const claims = await identity.verifyToken(token);
    if (claims) {
      user = { ref: claims.sub, accessKeyId: claims.accessKeyId };
      const requested = headerValue(opts.req.headers[WORKSPACE_HEADER]);
      if (requested) {
        const match = claims.access.find((a) => a.accessKeyId === requested);
        if (match) {
          workspace = { accessKeyId: match.accessKeyId, role: match.role };
        }
      }
    }
  }

  return {
    token,
    user,
    workspace,
    prisma,
    identity,
    voiceApplications,
    outboundCallClient,
    smsClient,
    fonosterNumbers,
    twilioFromNumbers,
    fonosterPrerecordedAppRef,
    insightGenerator,
    aiGeneration: config.ai?.generation ?? "onDemand",
    timezone: config.timezone
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
