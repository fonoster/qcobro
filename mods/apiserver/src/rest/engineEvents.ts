import type { Request, Response } from "express";
import { parseBasicAuth } from "./basicAuth.js";

/**
 * Minimal shape of the config slice this module needs: the engine tick
 * interval and the deployment-wide per-channel pacing caps. Absent provider
 * blocks (channel not configured) read as `0` in the response, mirroring how
 * the engine treats an unconfigured channel as paused.
 */
export interface EngineEventsConfig {
  engine: { tickSeconds: number };
  fonoster?: { maxCallsPerMinute: number } | null;
  twilio?: { maxSmsPerMinute: number } | null;
  resend?: { maxEmailsPerMinute: number } | null;
  whatsapp?: { maxMessagesPerMinute: number } | null;
}

/** Hard cap on events per response; wider ranges must be narrowed by the caller. */
const MAX_EVENTS = 100_000;

/** Deployment-level tick lifecycle kinds — the only rows with a null workspaceRef. */
const TICK_LIFECYCLE_KINDS = ["TICK_STARTED", "TICK_COMPLETED"] as const;

/** Minimal Prisma surface used to read the flight-recorder stream. */
export interface EngineEventsPrisma {
  engineEvent: {
    findMany(args: {
      where: {
        at?: { gte?: Date; lte?: Date };
        OR: (
          | { workspaceRef: string }
          | { workspaceRef: null; kind: { in: (typeof TICK_LIFECYCLE_KINDS)[number][] } }
        )[];
      };
      orderBy: [{ at: "asc" }, { seq: "asc" }];
      select: { payload: true };
      take: number;
    }): Promise<{ payload: unknown }[]>;
  };
}

/**
 * Exchange + verify functions this handler needs from the Identity client —
 * the same calls `auth.ts`'s `exchangeApiKey` procedure and `context.ts`'s
 * bearer-token resolution make, chained here to validate a standalone
 * accessKeyId/accessKeySecret pair with no prior request context.
 */
export interface EngineEventsIdentity {
  exchangeApiKey(accessKeyId: string, accessKeySecret: string): Promise<{ accessToken: string }>;
  verifyToken(token: string): Promise<{ access: { accessKeyId: string; role: string }[] } | null>;
}

/**
 * Extracts an accessKeyId/accessKeySecret pair from an HTTP Basic header.
 * Returns null for missing/malformed headers (no scheme, bad base64, no
 * separator, or an empty id/secret).
 */
export function parseBasicApiKey(
  authHeader: string | undefined
): { accessKeyId: string; accessKeySecret: string } | null {
  const creds = parseBasicAuth(authHeader);
  if (!creds || !creds.username || !creds.password) return null;
  return { accessKeyId: creds.username, accessKeySecret: creds.password };
}

/**
 * Validates an API key pair against Identity and resolves the workspace it
 * belongs to. A workspace API key unlocks exactly one workspace, so the
 * verified token's `access` claim is expected to carry exactly one entry;
 * its `accessKeyId` is the same string stored as `workspaceRef` on every
 * workspace-scoped Prisma row (see `ctx.workspace.accessKeyId` in
 * `trpc/context.ts`). Returns null on any failure (invalid pair, network
 * error, no workspace on the token) so the caller can respond 401 uniformly.
 */
async function resolveWorkspaceRef(
  identity: EngineEventsIdentity,
  accessKeyId: string,
  accessKeySecret: string
): Promise<string | null> {
  try {
    const { accessToken } = await identity.exchangeApiKey(accessKeyId, accessKeySecret);
    const claims = await identity.verifyToken(accessToken);
    // A workspace API key must resolve to exactly one workspace. Anything else
    // (multi-workspace token from a future Identity change) is rejected rather
    // than picking an arbitrary entry and leaking another workspace's stream.
    if (!claims || claims.access.length !== 1) return null;
    return claims.access[0].accessKeyId;
  } catch {
    return null;
  }
}

/** Parses an optional ISO datetime query param; returns undefined when absent, null when invalid. */
function parseDateParam(value: unknown): Date | undefined | null {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Builds the `GET /api/engine/events` handler (engine-events capability): a
 * read-only, workspace-scoped export of the flight-recorder stream plus the
 * deployment's engine parameters, consumed by the `engine-eval` CLI. Auth is
 * HTTP Basic (accessKeyId:accessKeySecret) validated against Fonoster
 * Identity — the same exchange the SDK's API-key login uses. The response
 * includes the caller's own workspace events plus the deployment-level tick
 * lifecycle events (needed to verify the rate-cap and tick-duration
 * invariants from a workspace-scoped stream); another workspace's events are
 * never returned.
 */
export function createEngineEventsHandler(
  prisma: EngineEventsPrisma,
  config: EngineEventsConfig,
  identity: EngineEventsIdentity
) {
  return async (req: Request, res: Response): Promise<void> => {
    const creds = parseBasicApiKey(req.headers.authorization);
    if (!creds) {
      res.status(401).json({ error: "Missing or invalid API key credentials" });
      return;
    }

    const workspaceRef = await resolveWorkspaceRef(
      identity,
      creds.accessKeyId,
      creds.accessKeySecret
    );
    if (!workspaceRef) {
      res.status(401).json({ error: "Invalid API key credentials" });
      return;
    }

    const from = parseDateParam(req.query.from);
    if (from === null) {
      res.status(400).json({ error: "Invalid 'from' datetime" });
      return;
    }
    const to = parseDateParam(req.query.to);
    if (to === null) {
      res.status(400).json({ error: "Invalid 'to' datetime" });
      return;
    }

    const rows = await prisma.engineEvent.findMany({
      where: {
        ...(from || to
          ? { at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
        OR: [{ workspaceRef }, { workspaceRef: null, kind: { in: [...TICK_LIFECYCLE_KINDS] } }]
      },
      orderBy: [{ at: "asc" }, { seq: "asc" }],
      select: { payload: true },
      take: MAX_EVENTS + 1
    });

    // A capped response keeps a wide range from serializing a whole retention
    // window in one body; the flag lets the CLI tell the operator to narrow it.
    const truncated = rows.length > MAX_EVENTS;
    res.status(200).json({
      events: (truncated ? rows.slice(0, MAX_EVENTS) : rows).map((r) => r.payload),
      truncated,
      parameters: {
        tickSeconds: config.engine.tickSeconds,
        ratesPerMinute: {
          voice: config.fonoster?.maxCallsPerMinute ?? 0,
          sms: config.twilio?.maxSmsPerMinute ?? 0,
          email: config.resend?.maxEmailsPerMinute ?? 0,
          whatsApp: config.whatsapp?.maxMessagesPerMinute ?? 0
        }
      }
    });
  };
}
