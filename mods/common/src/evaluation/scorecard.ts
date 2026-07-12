import { z } from "zod";

/**
 * Contracts for the engine judge: the parameter set `evaluate` runs against and
 * the scorecard it produces. Thresholds default here; rate caps and the tick
 * interval mirror the deployment's engine config and are supplied by the caller
 * (the events endpoint returns them alongside the stream).
 */

export const evaluationParametersSchema = z.object({
  /** Seconds between engine ticks (`engine.tickSeconds`). */
  tickSeconds: z.number().int().positive(),
  /** Deployment-wide pacing caps, mirroring the engine config. `0` = channel paused. */
  ratesPerMinute: z.object({
    voice: z.number().nonnegative(),
    sms: z.number().nonnegative(),
    email: z.number().nonnegative(),
    whatsApp: z.number().nonnegative()
  }),
  thresholds: z
    .object({
      /** PERF-2: p95 of provider dispatch latency (the API call, not call duration). */
      dispatchLatencyP95Ms: z.number().positive().default(2000),
      /** PERF-3: max fraction of dispatches that may fail, per channel. */
      maxErrorRate: z.number().min(0).max(1).default(0.02),
      /** LIVE-1: max consecutive budget-starved in-window ticks before an account counts as starved. */
      livenessTicks: z.number().int().positive().default(10)
    })
    .prefault({})
});

export type EvaluationParameters = z.infer<typeof evaluationParametersSchema>;

export type InvariantId =
  | "SAF-1"
  | "SAF-2"
  | "SAF-3"
  | "SAF-4"
  | "SAF-5"
  | "SAF-6"
  | "PERF-1"
  | "PERF-2"
  | "PERF-3"
  | "PERF-4"
  | "LIVE-1";

export type Verdict = "pass" | "fail";

/**
 * Which slice of the deployment an invariant was verified over. A
 * workspace-filtered stream still verifies `deployment`-scoped invariants from
 * the shared tick lifecycle events (aggregate counts).
 */
export type InvariantScope = "workspace" | "deployment";

/** One proven breach, traceable through the correlation spine. */
export interface Violation {
  campaignId?: string;
  portfolioAccountId?: string;
  /** The events that evidence the breach. */
  eventIds: string[];
  detail: string;
}

export interface InvariantResult {
  id: InvariantId;
  /** Human name, stable for display. */
  name: string;
  scope: InvariantScope;
  verdict: Verdict;
  /** Measured value where the invariant is a threshold (e.g. "p95 2410ms"). */
  metric?: string;
  violations: Violation[];
}

/** Per-campaign slice of the run. */
export interface CampaignBreakdown {
  campaignId: string;
  /** Display name from the stream's `campaign.evaluated` events (absent on old streams). */
  name?: string;
  workspaceRef: string;
  /** Ticks in which the campaign was evaluated. */
  ticksSeen: number;
  /** Account decisions recorded (one per considered account per tick). */
  considered: number;
  dispatched: number;
  failed: number;
  /** Funnel exclusions (missing contact, suppressions, caps). */
  suppressed: number;
  /** Violation count per invariant attributed to this campaign. */
  violations: Partial<Record<InvariantId, number>>;
}

/** A tick that started but never completed (crash or lost flush) — reported, not failed. */
export interface StreamGap {
  tickId: string;
  at: string;
}

export interface Scorecard {
  verdict: Verdict;
  invariants: InvariantResult[];
  campaigns: CampaignBreakdown[];
  gaps: StreamGap[];
  totals: {
    events: number;
    ticks: number;
    campaigns: number;
    /** Distinct (campaign, account) pairs that received at least one decision. */
    accountsConsidered: number;
  };
}
