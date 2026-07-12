import type {
  AccountDecidedEvent,
  AttemptReservedEvent,
  CampaignEvaluatedEvent,
  CampaignSnapshot,
  DispatchFailedEvent,
  DispatchRequestedEvent,
  DispatchSucceededEvent,
  EngineEvent,
  TickCompletedEvent,
  TickStartedEvent
} from "../schemas/engineEvents.js";
import type { EngineChannel } from "../types/engine.js";
import { isWithinScheduleWindow, localDateString } from "../utils/time.js";
import { bucketOf, perTickCapacity } from "../utils/pacing.js";
import type {
  CampaignBreakdown,
  EvaluationParameters,
  InvariantId,
  InvariantResult,
  InvariantScope,
  Scorecard,
  StreamGap,
  Violation
} from "./scorecard.js";

/**
 * The judge: replay an engine event stream against the invariant catalog and
 * produce a scorecard. Pure — no I/O, no clock, no randomness — so the same
 * input always yields a deeply equal scorecard, whether the stream came from a
 * CI simulation or a production export.
 *
 * A stream is allowed to be partial (workspace-filtered, time-bounded): checks
 * only fire on breaches the stream itself proves, so a partial stream can
 * under-detect but never false-positive. Deployment-scoped invariants (SAF-5,
 * PERF-1) read the shared tick lifecycle events, which carry aggregate counts.
 */

const SUPPRESSION_DECISIONS = new Set([
  "no_phone",
  "no_email",
  "intent_suppressed",
  "account_suppressed",
  "promise_suppressed",
  "lifetime_cap",
  "daily_cap"
]);

function rateFor(channel: string, rates: EvaluationParameters["ratesPerMinute"]): number {
  return rates[bucketOf(channel as EngineChannel)];
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

/** The engine's own window rule, applied to the snapshot the stream carries. */
function inSnapshotWindow(s: CampaignSnapshot, at: Date): boolean {
  return isWithinScheduleWindow(
    {
      startDate: new Date(s.startDate),
      endDate: s.endDate ? new Date(s.endDate) : null,
      daysOfWeek: s.daysOfWeek,
      startTime: s.startTime,
      endTime: s.endTime
    },
    at,
    s.timezone
  );
}

const key = (campaignId: string, accountId: string) => `${campaignId}|${accountId}`;

/** A (campaign, account) pair's aggregated reservations — structured, no key parsing. */
interface PairAgg {
  campaignId: string;
  portfolioAccountId: string;
  reservations: AttemptReservedEvent[];
}

interface TickSlice {
  tickId: string;
  started?: TickStartedEvent;
  completed?: TickCompletedEvent;
  evaluated: CampaignEvaluatedEvent[];
  decided: AccountDecidedEvent[];
  reserved: AttemptReservedEvent[];
  requested: DispatchRequestedEvent[];
}

interface Indexed {
  ticks: TickSlice[];
  /** Latest snapshot per campaign per tick, plus last-known overall. */
  snapshotAt: Map<string, CampaignSnapshot>; // `${tickId}\0${campaignId}`
  lastSnapshot: Map<string, CampaignSnapshot>; // campaignId
  reservedByPair: Map<string, PairAgg>;
  requested: DispatchRequestedEvent[];
  succeeded: DispatchSucceededEvent[];
  failed: DispatchFailedEvent[];
  decided: AccountDecidedEvent[];
}

function indexStream(events: EngineEvent[]): Indexed {
  const byTick = new Map<string, TickSlice>();
  const tickOrder: string[] = [];
  const slice = (tickId: string): TickSlice => {
    let s = byTick.get(tickId);
    if (!s) {
      s = { tickId, evaluated: [], decided: [], reserved: [], requested: [] };
      byTick.set(tickId, s);
      tickOrder.push(tickId);
    }
    return s;
  };

  const idx: Indexed = {
    ticks: [],
    snapshotAt: new Map(),
    lastSnapshot: new Map(),
    reservedByPair: new Map(),
    requested: [],
    succeeded: [],
    failed: [],
    decided: []
  };

  for (const e of events) {
    switch (e.kind) {
      case "tick.started":
        if (e.tickId) slice(e.tickId).started = e;
        break;
      case "tick.completed":
        if (e.tickId) slice(e.tickId).completed = e;
        break;
      case "campaign.evaluated":
        if (e.tickId) slice(e.tickId).evaluated.push(e);
        idx.snapshotAt.set(key(e.tickId ?? "", e.campaignId), e.snapshot);
        idx.lastSnapshot.set(e.campaignId, e.snapshot);
        break;
      case "account.decided":
        if (e.tickId) slice(e.tickId).decided.push(e);
        idx.decided.push(e);
        break;
      case "attempt.reserved": {
        if (e.tickId) slice(e.tickId).reserved.push(e);
        const k = key(e.campaignId, e.portfolioAccountId);
        let agg = idx.reservedByPair.get(k);
        if (!agg) {
          agg = {
            campaignId: e.campaignId,
            portfolioAccountId: e.portfolioAccountId,
            reservations: []
          };
          idx.reservedByPair.set(k, agg);
        }
        agg.reservations.push(e);
        break;
      }
      case "dispatch.requested":
        if (e.tickId) slice(e.tickId).requested.push(e);
        idx.requested.push(e);
        break;
      case "dispatch.succeeded":
        idx.succeeded.push(e);
        break;
      case "dispatch.failed":
        idx.failed.push(e);
        break;
      case "provider.event":
        break;
    }
  }

  idx.ticks = tickOrder.map((t) => byTick.get(t)!);
  return idx;
}

/** Snapshot for a campaign as of a given tick, falling back to the last known one. */
function snapshotFor(idx: Indexed, tickId: string | undefined, campaignId: string) {
  return idx.snapshotAt.get(key(tickId ?? "", campaignId)) ?? idx.lastSnapshot.get(campaignId);
}

function result(
  id: InvariantId,
  name: string,
  scope: InvariantScope,
  violations: Violation[],
  metric?: string
): InvariantResult {
  return {
    id,
    name,
    scope,
    verdict: violations.length === 0 ? "pass" : "fail",
    metric,
    violations
  };
}

export function evaluate(events: EngineEvent[], parameters: EvaluationParameters): Scorecard {
  // Deterministic order regardless of how the caller assembled the stream.
  const sorted = [...events].sort(
    (a, b) =>
      a.at.localeCompare(b.at) ||
      (a.tickId ?? "").localeCompare(b.tickId ?? "") ||
      (a.seq ?? -1) - (b.seq ?? -1) ||
      a.id.localeCompare(b.id)
  );
  const idx = indexStream(sorted);
  const { tickSeconds, ratesPerMinute, thresholds } = parameters;

  // SAF-1 — no dispatch outside the campaign window.
  const saf1: Violation[] = [];
  for (const d of idx.requested) {
    const snap = snapshotFor(idx, d.tickId, d.campaignId);
    if (!snap) continue; // partial stream: nothing to judge against
    if (!inSnapshotWindow(snap, new Date(d.at))) {
      saf1.push({
        campaignId: d.campaignId,
        portfolioAccountId: d.portfolioAccountId,
        eventIds: [d.id],
        detail: `dispatched at ${d.at} outside window ${snap.startTime}–${snap.endTime} (${snap.timezone})`
      });
    }
  }

  // SAF-2 — lifetime attempt cap, judged against the cap in force at each
  // reservation's tick (caps are editable mid-campaign, so the latest snapshot
  // must not retroactively re-judge older attempts). In-stream reservations
  // alone exceeding the cap is a proven breach (the true total can only be higher).
  const saf2: Violation[] = [];
  for (const pair of idx.reservedByPair.values()) {
    const offending: AttemptReservedEvent[] = [];
    let capAtBreach = 0;
    pair.reservations.forEach((r, i) => {
      const snap = snapshotFor(idx, r.tickId, pair.campaignId);
      if (!snap) return;
      if (i + 1 > snap.maxAttemptsPerAccount) {
        offending.push(r);
        capAtBreach = snap.maxAttemptsPerAccount;
      }
    });
    if (offending.length > 0) {
      saf2.push({
        campaignId: pair.campaignId,
        portfolioAccountId: pair.portfolioAccountId,
        eventIds: offending.map((r) => r.id),
        detail: `${pair.reservations.length} attempts recorded, cap in force was ${capAtBreach}`
      });
    }
  }

  // SAF-3 — daily attempt cap on the workspace-local calendar day, judged
  // against the cap (and timezone) in force at each reservation's tick.
  const saf3: Violation[] = [];
  for (const pair of idx.reservedByPair.values()) {
    const countByDay = new Map<string, number>();
    const offendingByDay = new Map<string, { events: AttemptReservedEvent[]; cap: number }>();
    for (const r of pair.reservations) {
      const snap = snapshotFor(idx, r.tickId, pair.campaignId);
      if (!snap) continue;
      const day = localDateString(new Date(r.at), snap.timezone);
      const count = (countByDay.get(day) ?? 0) + 1;
      countByDay.set(day, count);
      if (count > snap.maxAttemptsPerDay) {
        const o = offendingByDay.get(day) ?? { events: [], cap: snap.maxAttemptsPerDay };
        o.events.push(r);
        o.cap = snap.maxAttemptsPerDay;
        offendingByDay.set(day, o);
      }
    }
    for (const [day, o] of offendingByDay) {
      saf3.push({
        campaignId: pair.campaignId,
        portfolioAccountId: pair.portfolioAccountId,
        eventIds: o.events.map((r) => r.id),
        detail: `${countByDay.get(day)} attempts on ${day}, daily cap in force was ${o.cap}`
      });
    }
  }

  // SAF-4 — an account the funnel suppressed in a tick must not be dispatched in
  // that same tick (cross-tick dispatch is legitimate: suppressions expire).
  const saf4: Violation[] = [];
  for (const t of idx.ticks) {
    const suppressed = new Map<string, AccountDecidedEvent>();
    for (const d of t.decided) {
      if (SUPPRESSION_DECISIONS.has(d.decision)) {
        suppressed.set(key(d.campaignId, d.portfolioAccountId), d);
      }
    }
    for (const r of t.requested) {
      const hit = suppressed.get(key(r.campaignId, r.portfolioAccountId));
      if (hit) {
        saf4.push({
          campaignId: r.campaignId,
          portfolioAccountId: r.portfolioAccountId,
          eventIds: [hit.id, r.id],
          detail: `dispatched at ${r.at} in the same tick the funnel excluded it (${hit.decision})`
        });
      }
    }
  }

  // SAF-5 — per-channel rate caps, from the deployment-level tick aggregates
  // with the engine's own per-tick capacity semantics.
  const saf5: Violation[] = [];
  let peakRate = 0;
  let peakChannel = "";
  for (const t of idx.ticks) {
    if (!t.completed) continue;
    for (const [channel, usage] of Object.entries(t.completed.channelUsage)) {
      if (!usage) continue;
      const cap = perTickCapacity(rateFor(channel, ratesPerMinute), tickSeconds);
      const perMinute = (usage.dispatched * 60) / tickSeconds;
      if (perMinute > peakRate) {
        peakRate = perMinute;
        peakChannel = channel;
      }
      if (usage.dispatched > cap) {
        saf5.push({
          eventIds: [t.completed.id],
          detail: `tick ${t.tickId}: ${usage.dispatched} ${channel} dispatches, per-tick cap is ${cap}`
        });
      }
    }
  }

  // SAF-6 — at-most-once: every dispatch has its reservation in the same tick,
  // one dispatch per reservation, and no provider ref appears twice.
  const saf6: Violation[] = [];
  interface PairSlot {
    campaignId: string;
    portfolioAccountId: string;
    reserved: number;
    requested: DispatchRequestedEvent[];
  }
  for (const t of idx.ticks) {
    const perPair = new Map<string, PairSlot>();
    const slot = (campaignId: string, portfolioAccountId: string): PairSlot => {
      const k = key(campaignId, portfolioAccountId);
      let sl = perPair.get(k);
      if (!sl) {
        sl = { campaignId, portfolioAccountId, reserved: 0, requested: [] };
        perPair.set(k, sl);
      }
      return sl;
    };
    for (const r of t.reserved) slot(r.campaignId, r.portfolioAccountId).reserved += 1;
    for (const d of t.requested) slot(d.campaignId, d.portfolioAccountId).requested.push(d);
    for (const sl of perPair.values()) {
      if (sl.requested.length > sl.reserved) {
        saf6.push({
          campaignId: sl.campaignId,
          portfolioAccountId: sl.portfolioAccountId,
          eventIds: sl.requested.map((d) => d.id),
          detail: `${sl.requested.length} dispatch(es) against ${sl.reserved} reservation(s) in tick ${t.tickId}`
        });
      }
    }
  }
  const refSeen = new Map<string, DispatchSucceededEvent>();
  for (const s of idx.succeeded) {
    const prior = refSeen.get(s.providerRef);
    if (prior) {
      saf6.push({
        campaignId: s.campaignId,
        portfolioAccountId: s.portfolioAccountId,
        eventIds: [prior.id, s.id],
        detail: `provider ref ${s.providerRef} appears on two successful dispatches`
      });
    } else {
      refSeen.set(s.providerRef, s);
    }
  }

  // PERF-1 — ticks must finish inside the tick interval.
  const perf1: Violation[] = [];
  const durations: number[] = [];
  for (const t of idx.ticks) {
    if (!t.completed) continue;
    durations.push(t.completed.durationMs);
    if (t.completed.durationMs > tickSeconds * 1000) {
      perf1.push({
        eventIds: [t.completed.id],
        detail: `tick ${t.tickId} ran ${Math.round(t.completed.durationMs)}ms, interval is ${tickSeconds * 1000}ms`
      });
    }
  }

  // PERF-2 — dispatch latency p95.
  const allDispatches = [...idx.succeeded, ...idx.failed];
  const latencies = allDispatches.map((d) => d.latencyMs);
  const latP95 = p95(latencies);
  const perf2: Violation[] = [];
  if (latencies.length > 0 && latP95 > thresholds.dispatchLatencyP95Ms) {
    const worst = allDispatches.reduce((w, d) => (d.latencyMs > w.latencyMs ? d : w));
    perf2.push({
      campaignId: worst.campaignId,
      portfolioAccountId: worst.portfolioAccountId,
      eventIds: [worst.id],
      detail: `p95 ${Math.round(latP95)}ms over ${latencies.length} dispatches (threshold ${thresholds.dispatchLatencyP95Ms}ms; worst ${Math.round(worst.latencyMs)}ms)`
    });
  }

  // PERF-3 — per-channel error rate.
  const perf3: Violation[] = [];
  const byChannel = new Map<string, { ok: number; failed: DispatchFailedEvent[] }>();
  for (const s of idx.succeeded) {
    const c = byChannel.get(s.channel) ?? { ok: 0, failed: [] };
    c.ok += 1;
    byChannel.set(s.channel, c);
  }
  for (const f of idx.failed) {
    const c = byChannel.get(f.channel) ?? { ok: 0, failed: [] };
    c.failed.push(f);
    byChannel.set(f.channel, c);
  }
  let worstRate = 0;
  for (const [channel, c] of [...byChannel.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const total = c.ok + c.failed.length;
    const rate = total === 0 ? 0 : c.failed.length / total;
    worstRate = Math.max(worstRate, rate);
    if (rate > thresholds.maxErrorRate) {
      perf3.push({
        eventIds: c.failed.map((f) => f.id),
        detail: `${channel}: ${c.failed.length}/${total} dispatches failed (${(rate * 100).toFixed(1)}%, threshold ${(thresholds.maxErrorRate * 100).toFixed(1)}%)`
      });
    }
  }

  // PERF-4 — budget utilization: budget_exhausted while the channel bucket had
  // tokens left (voice channels share one bucket; skipped when the deployment
  // per-tick cap was the limiter).
  const perf4: Violation[] = [];
  for (const t of idx.ticks) {
    if (!t.completed || t.completed.perTickMaxReached) continue;
    const starved = t.decided.filter((d) => d.decision === "budget_exhausted");
    if (starved.length === 0) continue;
    const usage = t.completed.channelUsage;
    // Budgets are per pacing bucket: sum the bucket's channels' consumption
    // against the shared (max-reported) budget. bucketOf is the single encoding
    // of which channels share a bucket.
    const spentAll = (channel: string | null): boolean => {
      if (!channel) return true;
      const bucket = bucketOf(channel as EngineChannel);
      let dispatched = 0;
      let budget = 0;
      for (const [ch, u] of Object.entries(usage)) {
        if (!u || bucketOf(ch as EngineChannel) !== bucket) continue;
        dispatched += u.dispatched;
        budget = Math.max(budget, u.budget);
      }
      return dispatched >= budget;
    };
    for (const d of starved) {
      const snap = snapshotFor(idx, t.tickId, d.campaignId);
      if (!snap || spentAll(snap.channel)) continue;
      perf4.push({
        campaignId: d.campaignId,
        portfolioAccountId: d.portfolioAccountId,
        eventIds: [d.id, t.completed.id],
        detail: `skipped as budget_exhausted in tick ${t.tickId} while the ${snap.channel} budget had tokens left`
      });
    }
  }

  // LIVE-1 — no account starves: consecutive budget_exhausted ticks are bounded.
  const live1: Violation[] = [];
  const streaks = new Map<string, { streak: number; eventIds: string[]; flagged: boolean }>();
  let maxStreak = 0;
  for (const t of idx.ticks) {
    for (const d of t.decided) {
      const k = key(d.campaignId, d.portfolioAccountId);
      const s = streaks.get(k) ?? { streak: 0, eventIds: [], flagged: false };
      if (d.decision === "budget_exhausted") {
        s.streak += 1;
        s.eventIds.push(d.id);
        maxStreak = Math.max(maxStreak, s.streak);
        if (s.streak > thresholds.livenessTicks && !s.flagged) {
          s.flagged = true;
          live1.push({
            campaignId: d.campaignId,
            portfolioAccountId: d.portfolioAccountId,
            eventIds: [...s.eventIds],
            detail: `starved for ${s.streak} consecutive ticks (threshold ${thresholds.livenessTicks})`
          });
        }
      } else {
        s.streak = 0;
        s.eventIds = [];
        s.flagged = false;
      }
      streaks.set(k, s);
    }
  }

  const invariants: InvariantResult[] = [
    result("SAF-1", "window compliance", "workspace", saf1),
    result("SAF-2", "lifetime attempt cap", "workspace", saf2),
    result("SAF-3", "daily attempt cap", "workspace", saf3),
    result("SAF-4", "suppression respected", "workspace", saf4),
    result(
      "SAF-5",
      "channel rate caps",
      "deployment",
      saf5,
      peakChannel ? `peak ${peakRate.toFixed(1)}/min on ${peakChannel}` : undefined
    ),
    result("SAF-6", "at-most-once dispatch", "workspace", saf6),
    result(
      "PERF-1",
      "tick duration",
      "deployment",
      perf1,
      durations.length > 0 ? `p95 ${Math.round(p95(durations))}ms` : undefined
    ),
    result(
      "PERF-2",
      "dispatch latency p95",
      "workspace",
      perf2,
      latencies.length > 0 ? `p95 ${Math.round(latP95)}ms` : undefined
    ),
    result(
      "PERF-3",
      "dispatch error rate",
      "workspace",
      perf3,
      latencies.length > 0 ? `worst ${(worstRate * 100).toFixed(1)}%` : undefined
    ),
    result("PERF-4", "budget utilization", "workspace", perf4),
    result("LIVE-1", "ticks to first attempt", "workspace", live1, `max streak ${maxStreak}`)
  ];

  // Per-campaign breakdown + violation attribution.
  const campaigns = new Map<string, CampaignBreakdown>();
  const breakdown = (campaignId: string, workspaceRef: string): CampaignBreakdown => {
    let b = campaigns.get(campaignId);
    if (!b) {
      b = {
        campaignId,
        workspaceRef,
        ticksSeen: 0,
        considered: 0,
        dispatched: 0,
        failed: 0,
        suppressed: 0,
        violations: {}
      };
      campaigns.set(campaignId, b);
    }
    return b;
  };
  for (const t of idx.ticks) {
    for (const e of t.evaluated) {
      const b = breakdown(e.campaignId, e.workspaceRef);
      b.ticksSeen += 1;
      if (e.campaignName) b.name = e.campaignName;
    }
  }
  const pairs = new Set<string>();
  for (const d of idx.decided) {
    const b = breakdown(d.campaignId, d.workspaceRef);
    b.considered += 1;
    pairs.add(key(d.campaignId, d.portfolioAccountId));
    if (d.decision === "dispatched") b.dispatched += 1;
    else if (d.decision === "dispatch_failed") b.failed += 1;
    else if (SUPPRESSION_DECISIONS.has(d.decision)) b.suppressed += 1;
  }
  for (const inv of invariants) {
    for (const v of inv.violations) {
      if (!v.campaignId) continue;
      const b = campaigns.get(v.campaignId);
      if (!b) continue;
      b.violations[inv.id] = (b.violations[inv.id] ?? 0) + 1;
    }
  }

  const gaps: StreamGap[] = idx.ticks
    .filter((t) => t.started && !t.completed)
    .map((t) => ({ tickId: t.tickId, at: t.started!.at }));

  return {
    verdict: invariants.some((i) => i.verdict === "fail") ? "fail" : "pass",
    invariants,
    campaigns: [...campaigns.values()].sort((a, b) => a.campaignId.localeCompare(b.campaignId)),
    gaps,
    totals: {
      events: sorted.length,
      ticks: idx.ticks.length,
      campaigns: campaigns.size,
      accountsConsidered: pairs.size
    }
  };
}
