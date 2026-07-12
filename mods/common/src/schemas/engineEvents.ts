import { z } from "zod";
import { dispatchChannelSchema } from "./dispatch.js";

/**
 * Engine flight-recorder events. The engine (and the inbound provider webhooks)
 * emit these as an append-only stream; the pure evaluator in `../evaluation/`
 * replays a stream to prove a run stayed within parameters. Events are
 * self-contained: `campaign.evaluated` snapshots the config in force that tick,
 * so evaluating never requires reading live campaign rows.
 *
 * Correlation spine: `tickId` + `seq` order events within a tick;
 * `workspaceRef`/`campaignId`/`portfolioAccountId`/`providerRef` tie them to the
 * domain. Only tick lifecycle events are deployment-level (one engine loop ticks
 * across all workspaces) — everything else carries `workspaceRef`.
 *
 * Privacy: recipient identifiers are masked (see `maskRecipient`); rendered
 * bodies, scripts, and transcripts never enter the stream (they live on the
 * gestión).
 */

export const engineEventKindSchema = z.enum([
  "tick.started",
  "tick.completed",
  "campaign.evaluated",
  "account.decided",
  "attempt.reserved",
  "dispatch.requested",
  "dispatch.succeeded",
  "dispatch.failed",
  "provider.event"
]);

export type EngineEventKind = z.infer<typeof engineEventKindSchema>;

/** Fields every event carries; the correlation spine. */
const eventBase = z.object({
  /** Unique event id (uuid or `<tickId>#<seq>`); violations reference these. */
  id: z.string().min(1),
  /** Event instant (engine clock for tick events, receipt time for provider events), ISO. */
  at: z.string().min(1),
  /** The tick this event belongs to; absent on provider events (they arrive between ticks). */
  tickId: z.string().optional(),
  /** Monotonic order within the tick. */
  seq: z.number().int().nonnegative().optional()
});

/** Spine fields for events owned by a workspace (all non-tick events). */
const workspaceScoped = eventBase.extend({
  workspaceRef: z.string().min(1)
});

/** Per-channel numbers keyed by engine channel. */
const perChannel = <T extends z.ZodType>(value: T) => z.partialRecord(dispatchChannelSchema, value);

/** Snapshot of the campaign parameters in force during a tick (self-contained stream). */
export const campaignSnapshotSchema = z.object({
  status: z.string(),
  /** Local calendar bounds as ISO instants (the engine's stored campaign dates). */
  startDate: z.string(),
  endDate: z.string().nullable(),
  /** ISO weekdays (1 = Monday … 7 = Sunday). */
  daysOfWeek: z.array(z.number().int().min(1).max(7)),
  /** Local wall-clock bounds, `HH:MM` 24h. */
  startTime: z.string(),
  endTime: z.string(),
  maxAttemptsPerAccount: z.number().int().nonnegative(),
  maxAttemptsPerDay: z.number().int().nonnegative(),
  /** IANA timezone of the campaign's workspace (drives window + daily-cap math). */
  timezone: z.string(),
  channel: dispatchChannelSchema.nullable()
});

export type CampaignSnapshot = z.infer<typeof campaignSnapshotSchema>;

const tickStartedSchema = eventBase.extend({
  kind: z.literal("tick.started"),
  /** Tokens granted per channel this tick (perTickCapacity of the per-minute rates). */
  budgets: perChannel(z.number().int().nonnegative()),
  /** The deployment-wide per-tick dispatch cap, when configured. */
  perTickMax: z.number().int().nonnegative().optional()
});

const tickCompletedSchema = eventBase.extend({
  kind: z.literal("tick.completed"),
  durationMs: z.number().nonnegative(),
  /** Total dispatches across all workspaces this tick. */
  dispatched: z.number().int().nonnegative(),
  /** Whether the deployment-wide per-tick cap was hit (skews budget-utilization checks). */
  perTickMaxReached: z.boolean(),
  /**
   * Tokens consumed vs granted per bucket (`dispatched` = consumed — a failed
   * dispatch still spends its token). The voice channels share one bucket whose
   * consumption is reported on VOICE_AI.
   */
  channelUsage: perChannel(
    z.object({ dispatched: z.number().int().nonnegative(), budget: z.number().int().nonnegative() })
  )
});

const campaignEvaluatedSchema = workspaceScoped.extend({
  kind: z.literal("campaign.evaluated"),
  campaignId: z.string().min(1),
  /** Display name at evaluation time — scorecards read it so consumers never join back. */
  campaignName: z.string().optional(),
  inWindow: z.boolean(),
  skipReason: z.string().optional(),
  /** Set when the engine auto-completed the campaign this tick. */
  completed: z.boolean().optional(),
  /** Candidates loaded for the campaign (0 when skipped before loading). */
  candidateCount: z.number().int().nonnegative(),
  snapshot: campaignSnapshotSchema
});

const accountDecidedSchema = workspaceScoped.extend({
  kind: z.literal("account.decided"),
  campaignId: z.string().min(1),
  portfolioAccountId: z.string().min(1),
  /** An `AccountDecision` (`dispatched`, `budget_exhausted`, suppression reasons, …). */
  decision: z.string().min(1),
  providerRef: z.string().optional()
});

const attemptReservedSchema = workspaceScoped.extend({
  kind: z.literal("attempt.reserved"),
  campaignId: z.string().min(1),
  portfolioAccountId: z.string().min(1)
});

const dispatchRequestedSchema = workspaceScoped.extend({
  kind: z.literal("dispatch.requested"),
  campaignId: z.string().min(1),
  portfolioAccountId: z.string().min(1),
  channel: dispatchChannelSchema,
  /** Masked recipient (see `maskRecipient`) — never the full identifier. */
  toMasked: z.string()
});

const dispatchSucceededSchema = workspaceScoped.extend({
  kind: z.literal("dispatch.succeeded"),
  campaignId: z.string().min(1),
  portfolioAccountId: z.string().min(1),
  channel: dispatchChannelSchema,
  providerRef: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  toMasked: z.string()
});

const dispatchFailedSchema = workspaceScoped.extend({
  kind: z.literal("dispatch.failed"),
  campaignId: z.string().min(1),
  portfolioAccountId: z.string().min(1),
  channel: dispatchChannelSchema,
  latencyMs: z.number().nonnegative(),
  /** Coarse classification (the error's constructor name or "Error"). */
  errorClass: z.string(),
  errorMessage: z.string(),
  toMasked: z.string()
});

const providerEventSchema = eventBase.extend({
  kind: z.literal("provider.event"),
  /** Owning workspace, resolved from the matched gestión; absent when unmatched. */
  workspaceRef: z.string().optional(),
  /** Which inbound surface received it. */
  source: z.enum(["voice-events", "contact-logs", "meta-whatsapp", "email-inbound"]),
  providerRef: z.string().optional(),
  /** Provider-side timestamp when the payload carries one (receipt time is `at`). */
  providerAt: z.string().optional(),
  /** Whether the ref matched a known gestión. */
  matched: z.boolean(),
  campaignId: z.string().optional(),
  portfolioAccountId: z.string().optional(),
  /** Compact, content-free summary (event type, status, duration — never transcripts). */
  summary: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
});

export const engineEventSchema = z.discriminatedUnion("kind", [
  tickStartedSchema,
  tickCompletedSchema,
  campaignEvaluatedSchema,
  accountDecidedSchema,
  attemptReservedSchema,
  dispatchRequestedSchema,
  dispatchSucceededSchema,
  dispatchFailedSchema,
  providerEventSchema
]);

export type EngineEvent = z.infer<typeof engineEventSchema>;

/** `Omit` distributed over the union (a plain Omit collapses the discriminant). */
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event as emission sites provide it — the recorder fills the id/at/tickId/seq spine. */
export type EngineEventInput = DistOmit<EngineEvent, "id" | "at" | "tickId" | "seq">;
export type TickStartedEvent = z.infer<typeof tickStartedSchema>;
export type TickCompletedEvent = z.infer<typeof tickCompletedSchema>;
export type CampaignEvaluatedEvent = z.infer<typeof campaignEvaluatedSchema>;
export type AccountDecidedEvent = z.infer<typeof accountDecidedSchema>;
export type AttemptReservedEvent = z.infer<typeof attemptReservedSchema>;
export type DispatchRequestedEvent = z.infer<typeof dispatchRequestedSchema>;
export type DispatchSucceededEvent = z.infer<typeof dispatchSucceededSchema>;
export type DispatchFailedEvent = z.infer<typeof dispatchFailedSchema>;
export type ProviderEventEvent = z.infer<typeof providerEventSchema>;

/**
 * Where engine events land. Prisma-backed in production, in-memory in tests,
 * no-op when recording is disabled. Implementations MUST be best-effort: a
 * failing sink is caught and logged by the caller and never fails a tick or a
 * dispatch.
 */
export interface EngineEventSink {
  record(events: EngineEvent[]): Promise<void>;
}

/**
 * Mask a recipient identifier for the event stream. Phones keep the last 4
 * characters; emails keep the first character of the local part and the domain.
 */
export function maskRecipient(to: string): string {
  const at = to.indexOf("@");
  if (at > 0) {
    return `${to[0]}***@${to.slice(at + 1)}`;
  }
  if (to.length <= 4) return "*".repeat(to.length);
  return `${"*".repeat(to.length - 4)}${to.slice(-4)}`;
}
