import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { VoiceApplicationClient } from "@qcobro/common";
import { prisma } from "../db.js";
import { createIdentityClient } from "@fonoster/identity-client";
import { FonosterVoiceApplicationClient } from "../services/fonosterVoiceApplicationClient.js";
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

  return { token, user, workspace, prisma, identity, voiceApplications };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
