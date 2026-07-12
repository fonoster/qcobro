import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CampaignSnapshot, EngineEvent, EngineEventInput } from "../schemas/engineEvents.js";
import { evaluate } from "./evaluate.js";
import { evaluationParametersSchema, type InvariantId, type Scorecard } from "./scorecard.js";

/**
 * Fixture DSL: build a stream tick by tick. Defaults describe a healthy SMS
 * campaign in UTC with a wide-open window, so each red test flips exactly one
 * knob. tickSeconds=30 and sms=60/min give a per-tick SMS cap of 30.
 */

const params = () =>
  evaluationParametersSchema.parse({
    tickSeconds: 30,
    ratesPerMinute: { voice: 6, sms: 60, email: 60, whatsApp: 60 }
  });

const snapshot = (over: Partial<CampaignSnapshot> = {}): CampaignSnapshot => ({
  status: "ACTIVE",
  startDate: "2026-07-01T00:00:00.000Z",
  endDate: null,
  daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
  startTime: "00:00",
  endTime: "23:59",
  maxAttemptsPerAccount: 10,
  maxAttemptsPerDay: 5,
  timezone: "UTC",
  channel: "SMS",
  ...over
});

interface DispatchSpec {
  account: string;
  /** default true; false records a dispatch.failed */
  ok?: boolean;
  latencyMs?: number;
  ref?: string;
  /** default true; false skips the attempt.reserved event */
  reserve?: boolean;
}

interface TickSpec {
  tickId: string;
  /** Tick instant, ISO (all events in the tick share it — ordering comes from seq). */
  at: string;
  campaignId?: string;
  snapshot?: CampaignSnapshot;
  decisions?: Array<{ account: string; decision: string }>;
  dispatches?: DispatchSpec[];
  usage?: Record<string, { dispatched: number; budget: number }>;
  durationMs?: number;
  perTickMaxReached?: boolean;
  /** default true; false leaves the tick as a stream gap */
  completed?: boolean;
}

function tick(spec: TickSpec): EngineEvent[] {
  const cmp = spec.campaignId ?? "cmp_1";
  const snap = spec.snapshot ?? snapshot();
  const dispatches = spec.dispatches ?? [];
  const events: EngineEvent[] = [];
  let seq = 0;
  const push = (e: EngineEventInput) => {
    seq += 1;
    events.push({
      ...e,
      id: `${spec.tickId}#${seq}`,
      at: spec.at,
      tickId: spec.tickId,
      seq
    } as EngineEvent);
  };

  push({ kind: "tick.started", budgets: { SMS: 30, VOICE_AI: 3 } });
  push({
    kind: "campaign.evaluated",
    workspaceRef: "ws_1",
    campaignId: cmp,
    campaignName: `name of ${cmp}`,
    inWindow: true,
    candidateCount: (spec.decisions?.length ?? 0) + dispatches.length,
    snapshot: snap
  });
  for (const d of spec.decisions ?? []) {
    push({
      kind: "account.decided",
      workspaceRef: "ws_1",
      campaignId: cmp,
      portfolioAccountId: d.account,
      decision: d.decision
    });
  }
  for (const [i, d] of dispatches.entries()) {
    if (d.reserve !== false) {
      push({
        kind: "attempt.reserved",
        workspaceRef: "ws_1",
        campaignId: cmp,
        portfolioAccountId: d.account
      });
    }
    push({
      kind: "dispatch.requested",
      workspaceRef: "ws_1",
      campaignId: cmp,
      portfolioAccountId: d.account,
      channel: snap.channel ?? "SMS",
      toMasked: "********1234"
    });
    if (d.ok !== false) {
      push({
        kind: "dispatch.succeeded",
        workspaceRef: "ws_1",
        campaignId: cmp,
        portfolioAccountId: d.account,
        channel: snap.channel ?? "SMS",
        providerRef: d.ref ?? `${spec.tickId}-ref-${i}`,
        latencyMs: d.latencyMs ?? 150,
        toMasked: "********1234"
      });
      push({
        kind: "account.decided",
        workspaceRef: "ws_1",
        campaignId: cmp,
        portfolioAccountId: d.account,
        decision: "dispatched",
        providerRef: d.ref ?? `${spec.tickId}-ref-${i}`
      });
    } else {
      push({
        kind: "dispatch.failed",
        workspaceRef: "ws_1",
        campaignId: cmp,
        portfolioAccountId: d.account,
        channel: snap.channel ?? "SMS",
        latencyMs: d.latencyMs ?? 150,
        errorClass: "Error",
        errorMessage: "emulated failure",
        toMasked: "********1234"
      });
      push({
        kind: "account.decided",
        workspaceRef: "ws_1",
        campaignId: cmp,
        portfolioAccountId: d.account,
        decision: "dispatch_failed"
      });
    }
  }
  if (spec.completed !== false) {
    const dispatched = dispatches.filter((d) => d.ok !== false).length;
    push({
      kind: "tick.completed",
      durationMs: spec.durationMs ?? 500,
      dispatched,
      perTickMaxReached: spec.perTickMaxReached ?? false,
      channelUsage: spec.usage ?? { SMS: { dispatched, budget: 30 } }
    });
  }
  return events;
}

function invariant(card: Scorecard, id: InvariantId) {
  const inv = card.invariants.find((i) => i.id === id);
  assert.ok(inv, `invariant ${id} missing`);
  return inv;
}

function assertOnlyFails(card: Scorecard, ...ids: InvariantId[]) {
  const failed = card.invariants.filter((i) => i.verdict === "fail").map((i) => i.id);
  assert.deepEqual(failed.sort(), [...ids].sort());
  assert.equal(card.verdict, ids.length === 0 ? "pass" : "fail");
}

describe("evaluate", () => {
  it("is deterministic: same input yields deeply equal scorecards", () => {
    const events = [
      ...tick({ tickId: "t1", at: "2026-07-06T10:00:00.000Z", dispatches: [{ account: "a1" }] }),
      ...tick({ tickId: "t2", at: "2026-07-06T10:00:30.000Z", dispatches: [{ account: "a2" }] })
    ];
    // Also shuffle: order of the input array must not matter.
    const reversed = [...events].reverse();
    assert.deepEqual(evaluate(events, params()), evaluate(reversed, params()));
  });

  it("passes a healthy run and builds the campaign breakdown", () => {
    const events = [
      ...tick({
        tickId: "t1",
        at: "2026-07-06T10:00:00.000Z",
        decisions: [{ account: "a9", decision: "promise_suppressed" }],
        dispatches: [{ account: "a1" }, { account: "a2" }]
      }),
      ...tick({ tickId: "t2", at: "2026-07-06T10:00:30.000Z", dispatches: [{ account: "a1" }] })
    ];
    const card = evaluate(events, params());
    assertOnlyFails(card);
    assert.equal(card.gaps.length, 0);
    assert.equal(card.totals.ticks, 2);
    assert.equal(card.totals.campaigns, 1);
    assert.equal(card.totals.accountsConsidered, 3);
    const b = card.campaigns[0];
    assert.equal(b.campaignId, "cmp_1");
    assert.equal(b.name, "name of cmp_1");
    assert.equal(b.ticksSeen, 2);
    assert.equal(b.dispatched, 3);
    assert.equal(b.suppressed, 1);
    assert.deepEqual(b.violations, {});
  });

  it("SAF-1: flags a dispatch outside the window", () => {
    const night = snapshot({ startTime: "09:00", endTime: "18:00" });
    const events = tick({
      tickId: "t1",
      at: "2026-07-06T20:00:00.000Z",
      snapshot: night,
      dispatches: [{ account: "a1" }]
    });
    const card = evaluate(events, params());
    assertOnlyFails(card, "SAF-1");
    const v = invariant(card, "SAF-1").violations[0];
    assert.equal(v.campaignId, "cmp_1");
    assert.equal(v.portfolioAccountId, "a1");
    assert.ok(v.eventIds.length > 0);
    assert.equal(card.campaigns[0].violations["SAF-1"], 1);
  });

  it("SAF-2/SAF-3: judges each reservation against the cap in force at its tick", () => {
    // Two attempts made legitimately under a cap of 10; the cap is then lowered
    // to 1. The old attempts must NOT be retroactively flagged.
    const roomy = snapshot({ maxAttemptsPerAccount: 10 });
    const tightened = snapshot({ maxAttemptsPerAccount: 1 });
    const events = [
      ...tick({
        tickId: "t1",
        at: "2026-07-06T10:00:00.000Z",
        snapshot: roomy,
        dispatches: [{ account: "a1" }, { account: "a1" }]
      }),
      ...tick({ tickId: "t2", at: "2026-07-07T10:00:00.000Z", snapshot: tightened })
    ];
    assertOnlyFails(evaluate(events, params()));
  });

  it("SAF-2: flags reservations beyond the lifetime cap", () => {
    const capped = snapshot({ maxAttemptsPerAccount: 1 });
    const events = [
      ...tick({
        tickId: "t1",
        at: "2026-07-06T10:00:00.000Z",
        snapshot: capped,
        dispatches: [{ account: "a1" }]
      }),
      ...tick({
        tickId: "t2",
        at: "2026-07-07T10:00:00.000Z",
        snapshot: capped,
        dispatches: [{ account: "a1" }]
      })
    ];
    assertOnlyFails(evaluate(events, params()), "SAF-2");
  });

  it("SAF-3: flags a breached daily cap on the local calendar day", () => {
    const daily = snapshot({ maxAttemptsPerDay: 1 });
    const events = [
      ...tick({
        tickId: "t1",
        at: "2026-07-06T10:00:00.000Z",
        snapshot: daily,
        dispatches: [{ account: "a1" }]
      }),
      ...tick({
        tickId: "t2",
        at: "2026-07-06T15:00:00.000Z",
        snapshot: daily,
        dispatches: [{ account: "a1" }]
      })
    ];
    assertOnlyFails(evaluate(events, params()), "SAF-3");
  });

  it("SAF-3: two attempts on different local days are fine", () => {
    const daily = snapshot({ maxAttemptsPerDay: 1 });
    const events = [
      ...tick({
        tickId: "t1",
        at: "2026-07-06T10:00:00.000Z",
        snapshot: daily,
        dispatches: [{ account: "a1" }]
      }),
      ...tick({
        tickId: "t2",
        at: "2026-07-07T10:00:00.000Z",
        snapshot: daily,
        dispatches: [{ account: "a1" }]
      })
    ];
    assertOnlyFails(evaluate(events, params()));
  });

  it("SAF-4: flags a same-tick dispatch to a funnel-suppressed account", () => {
    const events = tick({
      tickId: "t1",
      at: "2026-07-06T10:00:00.000Z",
      decisions: [{ account: "a1", decision: "promise_suppressed" }],
      dispatches: [{ account: "a1" }]
    });
    assertOnlyFails(evaluate(events, params()), "SAF-4");
  });

  it("SAF-5: flags a tick that dispatched over the per-tick capacity", () => {
    const events = tick({
      tickId: "t1",
      at: "2026-07-06T10:00:00.000Z",
      usage: { SMS: { dispatched: 40, budget: 30 } }
    });
    const card = evaluate(events, params());
    assert.equal(invariant(card, "SAF-5").verdict, "fail");
  });

  it("SAF-5: dispatching exactly the per-tick capacity is fine (boundary)", () => {
    const events = tick({
      tickId: "t1",
      at: "2026-07-06T10:00:00.000Z",
      usage: { SMS: { dispatched: 30, budget: 30 } }
    });
    assert.equal(invariant(evaluate(events, params()), "SAF-5").verdict, "pass");
  });

  it("SAF-6: flags a dispatch without a reservation", () => {
    const events = tick({
      tickId: "t1",
      at: "2026-07-06T10:00:00.000Z",
      dispatches: [{ account: "a1", reserve: false }]
    });
    assertOnlyFails(evaluate(events, params()), "SAF-6");
  });

  it("SAF-6: flags a provider ref that appears on two successful dispatches", () => {
    const events = [
      ...tick({
        tickId: "t1",
        at: "2026-07-06T10:00:00.000Z",
        dispatches: [{ account: "a1", ref: "dup" }]
      }),
      ...tick({
        tickId: "t2",
        at: "2026-07-06T10:00:30.000Z",
        dispatches: [{ account: "a2", ref: "dup" }]
      })
    ];
    assertOnlyFails(evaluate(events, params()), "SAF-6");
  });

  it("PERF-1: flags a tick that overran the tick interval", () => {
    const events = tick({
      tickId: "t1",
      at: "2026-07-06T10:00:00.000Z",
      durationMs: 31_000
    });
    assertOnlyFails(evaluate(events, params()), "PERF-1");
  });

  it("PERF-2: flags dispatch latency p95 over the threshold", () => {
    const events = tick({
      tickId: "t1",
      at: "2026-07-06T10:00:00.000Z",
      dispatches: [{ account: "a1", latencyMs: 5000 }]
    });
    const card = evaluate(events, params());
    assertOnlyFails(card, "PERF-2");
    assert.match(invariant(card, "PERF-2").metric ?? "", /p95 5000ms/);
  });

  it("PERF-3: flags an error rate over the threshold", () => {
    const events = tick({
      tickId: "t1",
      at: "2026-07-06T10:00:00.000Z",
      dispatches: [{ account: "a1" }, { account: "a2", ok: false }]
    });
    assertOnlyFails(evaluate(events, params()), "PERF-3");
  });

  it("PERF-4: flags budget_exhausted while the channel had tokens left", () => {
    const events = tick({
      tickId: "t1",
      at: "2026-07-06T10:00:00.000Z",
      decisions: [{ account: "a1", decision: "budget_exhausted" }],
      usage: { SMS: { dispatched: 10, budget: 30 } }
    });
    assertOnlyFails(evaluate(events, params()), "PERF-4");
  });

  it("PERF-4: budget_exhausted with a spent bucket is fine", () => {
    const events = tick({
      tickId: "t1",
      at: "2026-07-06T10:00:00.000Z",
      decisions: [{ account: "a1", decision: "budget_exhausted" }],
      usage: { SMS: { dispatched: 30, budget: 30 } }
    });
    assertOnlyFails(evaluate(events, params()));
  });

  it("PERF-4: skips ticks where the deployment per-tick cap was the limiter", () => {
    const events = tick({
      tickId: "t1",
      at: "2026-07-06T10:00:00.000Z",
      decisions: [{ account: "a1", decision: "budget_exhausted" }],
      usage: { SMS: { dispatched: 10, budget: 30 } },
      perTickMaxReached: true
    });
    assertOnlyFails(evaluate(events, params()));
  });

  it("LIVE-1: flags an account starved past the liveness threshold", () => {
    const p = evaluationParametersSchema.parse({
      tickSeconds: 30,
      ratesPerMinute: { voice: 6, sms: 60, email: 60, whatsApp: 60 },
      thresholds: { livenessTicks: 2 }
    });
    const starvedTick = (tickId: string, at: string) =>
      tick({
        tickId,
        at,
        decisions: [{ account: "a1", decision: "budget_exhausted" }],
        usage: { SMS: { dispatched: 30, budget: 30 } }
      });
    const events = [
      ...starvedTick("t1", "2026-07-06T10:00:00.000Z"),
      ...starvedTick("t2", "2026-07-06T10:00:30.000Z"),
      ...starvedTick("t3", "2026-07-06T10:01:00.000Z")
    ];
    const card = evaluate(events, p);
    assertOnlyFails(card, "LIVE-1");
    assert.equal(invariant(card, "LIVE-1").violations[0].portfolioAccountId, "a1");
  });

  it("LIVE-1: a dispatch resets the starvation streak", () => {
    const p = evaluationParametersSchema.parse({
      tickSeconds: 30,
      ratesPerMinute: { voice: 6, sms: 60, email: 60, whatsApp: 60 },
      thresholds: { livenessTicks: 2 }
    });
    const events = [
      ...tick({
        tickId: "t1",
        at: "2026-07-06T10:00:00.000Z",
        decisions: [{ account: "a1", decision: "budget_exhausted" }],
        usage: { SMS: { dispatched: 30, budget: 30 } }
      }),
      ...tick({
        tickId: "t2",
        at: "2026-07-06T10:00:30.000Z",
        decisions: [{ account: "a1", decision: "budget_exhausted" }],
        usage: { SMS: { dispatched: 30, budget: 30 } }
      }),
      ...tick({ tickId: "t3", at: "2026-07-06T10:01:00.000Z", dispatches: [{ account: "a1" }] })
    ];
    assertOnlyFails(evaluate(events, p));
  });

  it("reports an incomplete tick as a gap, not a failure", () => {
    const events = [
      ...tick({ tickId: "t1", at: "2026-07-06T10:00:00.000Z", dispatches: [{ account: "a1" }] }),
      ...tick({ tickId: "t2", at: "2026-07-06T10:00:30.000Z", completed: false })
    ];
    const card = evaluate(events, params());
    assertOnlyFails(card);
    assert.deepEqual(card.gaps, [{ tickId: "t2", at: "2026-07-06T10:00:30.000Z" }]);
  });
});
