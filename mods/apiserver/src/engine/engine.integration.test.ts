import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  billingConfigSchema,
  evaluate,
  evaluationParametersSchema,
  type BillingConfig,
  type EngineEvent
} from "@qcobro/common";
import { createEngine } from "./engine.js";
import { createPrismaEngineClient } from "./prismaEngineClient.js";
import { createEngineRunner } from "./runner.js";
import { createEventPruner } from "./eventSink.js";
import { EmulatedSmsClient, InMemoryEngineEventSink } from "./emulators.js";

// Integration tests need a real Postgres. Skipped unless DATABASE_URL is set
// (the dev stack: `docker compose -f compose.dev.yaml up -d db`).
const RUN = !!process.env.DATABASE_URL;

const NOW = new Date("2026-06-23T15:00:00Z"); // Tue 09:00 local — inside the window

describe("campaigns engine (integration)", { skip: !RUN ? "no DATABASE_URL" : false }, () => {
  const prisma = new PrismaClient();
  const ws = `test-engine-${Date.now()}`;
  const tag = Math.random().toString(36).slice(2, 8);

  const phone = (n: number) => `+1555${tag}${String(n).padStart(2, "0")}`;

  async function seedCampaign(opts: { maxPerDay: number; accounts: number }) {
    const tmpl = await prisma.agentTemplate.create({
      data: {
        workspaceRef: ws,
        name: "SMS agent",
        type: "SMS",
        smsConfig: { create: { messageBody: "Hola {{firstName}}" } }
      }
    });
    const pf = await prisma.portfolio.create({
      data: { workspaceRef: ws, name: "PF", clientId: `cli-${tag}` }
    });
    for (let i = 0; i < opts.accounts; i++) {
      await prisma.portfolioAccount.create({
        data: {
          portfolioId: pf.id,
          externalId: `A-${tag}-${i}`,
          fullName: `Account ${i}`,
          phone: phone(i)
        }
      });
    }
    const camp = await prisma.campaign.create({
      data: {
        workspaceRef: ws,
        name: "Campaign",
        agentTemplateId: tmpl.id,
        status: "ACTIVE",
        startDate: new Date("2026-06-01T00:00:00Z"),
        endDate: new Date("2026-12-31T00:00:00Z"),
        startTime: "08:00",
        endTime: "18:00",
        daysOfWeek: [1, 2, 3, 4, 5],
        maxAttemptsPerAccount: 3,
        maxAttemptsPerDay: opts.maxPerDay,
        portfolios: { create: [{ portfolioId: pf.id }] }
      }
    });
    return { campaignId: camp.id };
  }

  function makeEngine(
    sms: EmulatedSmsClient,
    opts: { perTickMax?: number; billing?: BillingConfig } = {}
  ) {
    return createEngine({
      db: createPrismaEngineClient(prisma),
      reserveRecordClient: prisma,
      outboundCallClient: null,
      smsClient: sms,
      fonosterNumbers: [],
      twilioFromNumbers: ["+15550009999"],
      fonosterPrerecordedAppRef: null,
      clock: { now: () => NOW },
      voicePerMinute: 0,
      smsPerMinute: 60,
      emailPerMinute: 0,
      whatsAppPerMinute: 0,
      resolveWhatsApp: async () => null,
      tickSeconds: 60,
      perTickMax: opts.perTickMax,
      billing: opts.billing
    });
  }

  /** Judge parameters mirroring the engine wiring above. */
  const judgeParams = (thresholds: { livenessTicks?: number } = {}) =>
    evaluationParametersSchema.parse({
      tickSeconds: 60,
      ratesPerMinute: { voice: 0, sms: 60, email: 0, whatsApp: 0 },
      thresholds
    });

  const invariant = (events: EngineEvent[], id: string, thresholds = {}) =>
    evaluate(events, judgeParams(thresholds)).invariants.find((i) => i.id === id);

  const mine = (sms: EmulatedSmsClient) => sms.messages.filter((m) => m.to.includes(tag));

  // IDs of other ACTIVE campaigns we temporarily pause to isolate the test — restored
  // in `after` so the test never leaves the dev DB's real/seeded campaigns paused.
  let pausedByTest: string[] = [];

  before(async () => {
    const others = await prisma.campaign.findMany({
      where: { status: "ACTIVE", workspaceRef: { not: ws } },
      select: { id: true }
    });
    pausedByTest = others.map((c) => c.id);
    if (pausedByTest.length > 0) {
      await prisma.campaign.updateMany({
        where: { id: { in: pausedByTest } },
        data: { status: "PAUSED" }
      });
    }
  });

  after(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { workspaceRef: ws } });
    await prisma.usageRecord.deleteMany({ where: { workspaceRef: ws } });
    await prisma.workspaceBilling.deleteMany({ where: { workspaceRef: ws } });
    await prisma.billingAccount.deleteMany({ where: { createdFromUserRef: ws } });
    await prisma.campaign.deleteMany({ where: { workspaceRef: ws } });
    await prisma.portfolio.deleteMany({ where: { workspaceRef: ws } });
    await prisma.agentTemplate.deleteMany({ where: { workspaceRef: ws } });
    // Restore exactly the campaigns we paused for isolation.
    if (pausedByTest.length > 0) {
      await prisma.campaign.updateMany({
        where: { id: { in: pausedByTest } },
        data: { status: "ACTIVE" }
      });
    }
    await prisma.$disconnect();
  });

  it("dispatches eligible accounts and records one gestión each", async () => {
    const { campaignId } = await seedCampaign({ maxPerDay: 1, accounts: 2 });
    const sms = new EmulatedSmsClient();

    const report = await makeEngine(sms).tick();

    assert.equal(mine(sms).length, 2, "two SMS dispatched");
    const cr = report.campaigns.find((c) => c.campaignId === campaignId);
    assert.equal(cr?.dispatched, 2);

    const states = await prisma.campaignAccountState.findMany({ where: { campaignId } });
    assert.equal(states.length, 2);
    assert.ok(states.every((s) => s.attemptCount === 1 && s.attemptsToday === 1));

    const logs = await prisma.accountContactLog.findMany({ where: { campaignId } });
    assert.equal(logs.length, 2);
    assert.ok(logs.every((l) => l.providerRef && l.providerRef.startsWith("sim-sms-")));
  });

  it("does not double-dispatch on a re-tick — at-most-once per (campaign, account)", async () => {
    const { campaignId } = await seedCampaign({ maxPerDay: 1, accounts: 1 });
    const sms = new EmulatedSmsClient();
    const engine = makeEngine(sms);

    await engine.tick();
    const second = await engine.tick();

    assert.equal(mine(sms).length, 1, "still exactly one dispatch after a second tick");
    const cr = second.campaigns.find((c) => c.campaignId === campaignId);
    assert.equal(cr?.dispatched, 0, "second tick dispatches nothing");
    assert.ok(
      cr?.decisions.some((d) => d.decision === "daily_cap"),
      "account skipped by the daily cap"
    );
  });

  it("a crashed/failed dispatch consumes the attempt and is not retried", async () => {
    const { campaignId } = await seedCampaign({ maxPerDay: 1, accounts: 1 });

    // Tick 1: provider fails AFTER the reserve commits (simulates crash mid-dispatch).
    const failing = new EmulatedSmsClient({ fail: true });
    const first = await makeEngine(failing).tick();
    const cr1 = first.campaigns.find((c) => c.campaignId === campaignId);
    assert.ok(cr1?.decisions.some((d) => d.decision === "dispatch_failed"));
    assert.equal(mine(failing).length, 0, "nothing actually sent");

    // Tick 2: a healthy provider — the consumed attempt must NOT be retried this day.
    const healthy = new EmulatedSmsClient();
    await makeEngine(healthy).tick();
    assert.equal(mine(healthy).length, 0, "no retry of the consumed attempt (at-most-once)");
  });

  // ——— Flight recorder + scorecard (engine-events / engine-scorecard) ———

  it("a healthy multi-tick run yields a green scorecard from the recorded stream", async () => {
    const { campaignId } = await seedCampaign({ maxPerDay: 1, accounts: 2 });
    const sms = new EmulatedSmsClient();
    const engine = makeEngine(sms);

    const first = await engine.tick();
    const second = await engine.tick();
    const events = [...(first.events ?? []), ...(second.events ?? [])];
    assert.ok(events.length > 0, "the tick reports carry recorded events");

    const card = evaluate(events, judgeParams());
    assert.equal(card.verdict, "pass");
    assert.equal(card.gaps.length, 0);
    assert.equal(card.totals.ticks, 2);
    const breakdown = card.campaigns.find((c) => c.campaignId === campaignId);
    assert.equal(breakdown?.dispatched, 2);
    assert.deepEqual(breakdown?.violations, {});

    // Same stream, same parameters → deeply equal scorecards (judge determinism).
    assert.deepEqual(evaluate(events, judgeParams()), card);
  });

  it("scripted provider failures above the error threshold turn PERF-3 red", async () => {
    const { campaignId } = await seedCampaign({ maxPerDay: 1, accounts: 2 });
    const failing = new EmulatedSmsClient({ fail: true });

    const report = await makeEngine(failing).tick();
    const card = evaluate(report.events ?? [], judgeParams());

    assert.equal(card.verdict, "fail");
    const perf3 = card.invariants.find((i) => i.id === "PERF-3");
    assert.equal(perf3?.verdict, "fail");
    assert.equal(card.campaigns.find((c) => c.campaignId === campaignId)?.failed, 2);
  });

  it("a starved account is flagged by LIVE-1 (and PERF-4 stays quiet under perTickMax)", async () => {
    // perTickMax 0 legitimately starves every eligible account each tick: the funnel
    // admits them, the deployment cap blocks them. Three such ticks exceed a
    // livenessTicks of 2. PERF-4 must NOT fire — the limiter was the per-tick cap,
    // not an unspent channel bucket (tick.completed says perTickMaxReached).
    await seedCampaign({ maxPerDay: 1, accounts: 1 });
    const sms = new EmulatedSmsClient();
    const engine = makeEngine(sms, { perTickMax: 0 });

    const events: EngineEvent[] = [];
    for (let i = 0; i < 3; i++) events.push(...((await engine.tick()).events ?? []));

    assert.equal(mine(sms).length, 0, "nothing dispatched under a zero per-tick cap");
    assert.equal(invariant(events, "LIVE-1", { livenessTicks: 2 })?.verdict, "fail");
    assert.equal(invariant(events, "PERF-4")?.verdict, "pass");
  });

  it("the runner flushes tick events to the sink", async () => {
    await seedCampaign({ maxPerDay: 1, accounts: 1 });
    const sms = new EmulatedSmsClient();
    const sink = new InMemoryEngineEventSink();
    const runner = createEngineRunner({
      prisma,
      tick: makeEngine(sms).tick,
      tickSeconds: 60,
      log: () => undefined,
      eventSink: sink
    });

    await runner.runOnce();

    assert.ok(sink.events.length > 0, "sink received the tick's events");
    assert.ok(sink.events.some((e) => e.kind === "tick.completed"));
  });

  it("a failing sink never affects dispatch or gestiones (best-effort telemetry)", async () => {
    const { campaignId } = await seedCampaign({ maxPerDay: 1, accounts: 1 });
    const sms = new EmulatedSmsClient();
    const runner = createEngineRunner({
      prisma,
      tick: makeEngine(sms).tick,
      tickSeconds: 60,
      log: () => undefined,
      eventSink: new InMemoryEngineEventSink({ fail: true })
    });

    await runner.runOnce();

    assert.equal(mine(sms).length, 1, "dispatch went out despite the sink failure");
    const logs = await prisma.accountContactLog.findMany({ where: { campaignId } });
    assert.equal(logs.length, 1, "gestión recorded despite the sink failure");
  });

  it("meters dispatches, stops at credits_exhausted, and skips the campaign once drained", async () => {
    // Plan: SMS at 0.008 (8,000 micro). Grant 20,000 micro → covers exactly 2 SMS.
    const billing = billingConfigSchema.parse({
      enabled: true,
      voiceDebitEstimateSeconds: 60,
      plans: [
        {
          key: "starter",
          name: { en: "Starter", es: "Inicial" },
          monthlyPrice: 9,
          monthlyAllowance: 9,
          stripePriceId: "price_test",
          rates: {
            sms: { perMessage: 0.008 },
            email: { perMessage: 0.0004 },
            whatsappMessage: { perMessage: 0.01 },
            voicePrerecorded: { perMinute: 0.28, increments: "15/15" },
            voiceAi: { perMinute: 0.4, increments: "15/15" },
            whatsappVoicePrerecorded: { perMinute: 0.08, increments: "15/15" },
            whatsappVoiceAi: { perMinute: 0.8, increments: "15/15" }
          }
        }
      ]
    });
    const account = await prisma.billingAccount.create({
      data: { createdFromUserRef: ws, stripeCustomerId: `cus_${tag}` }
    });
    await prisma.workspaceBilling.create({
      data: { workspaceRef: ws, billingAccountId: account.id, planKey: "starter" }
    });
    await prisma.ledgerEntry.create({
      data: { workspaceRef: ws, kind: "GRANT", amountMicro: 20_000n, at: NOW }
    });

    const { campaignId } = await seedCampaign({ maxPerDay: 5, accounts: 4 });
    const sms = new EmulatedSmsClient();
    const engine = makeEngine(sms, { billing });

    // Tick 1: 2 dispatches fit the balance; the rest decide credits_exhausted.
    const report = await engine.tick();
    const cr = report.campaigns.find((r) => r.campaignId === campaignId)!;
    assert.equal(cr.dispatched, 2);
    const exhausted = cr.decisions.filter((d) => d.decision === "credits_exhausted");
    assert.equal(exhausted.length, 2);

    // Priced at write time, debited in the same transaction as the gestión.
    const usage = await prisma.usageRecord.findMany({ where: { workspaceRef: ws } });
    assert.equal(usage.length, 2);
    assert.ok(usage.every((u) => u.meter === "SMS" && u.amountMicro === 8_000n));
    const entries = await prisma.ledgerEntry.findMany({ where: { workspaceRef: ws } });
    const balance = entries.reduce((sum, e) => sum + e.amountMicro, 0n);
    assert.equal(balance, 4_000n); // 20,000 − 2 × 8,000

    // Tick 2: remaining 4,000 micro cannot cover one SMS → whole campaign skips.
    const report2 = await engine.tick();
    const cr2 = report2.campaigns.find((r) => r.campaignId === campaignId)!;
    assert.equal(cr2.dispatched, 0);
    assert.equal(cr2.skipReason, undefined); // balance is 4,000 (> 0) so the gate opens…
    assert.equal(
      cr2.decisions.filter((d) => d.decision === "credits_exhausted").length,
      cr2.decisions.filter((d) => d.decision !== "dispatched").length
    );

    // Drain to zero and verify the tick-start campaign skip.
    await prisma.ledgerEntry.create({
      data: { workspaceRef: ws, kind: "VOID", amountMicro: -4_000n, at: NOW }
    });
    const report3 = await engine.tick();
    const cr3 = report3.campaigns.find((r) => r.campaignId === campaignId)!;
    assert.equal(cr3.skipReason, "credits_exhausted");
    assert.equal(cr3.dispatched, 0);

    // billing.enabled=false bypasses gating AND metering (rollback switch).
    const disabled = { ...billing!, enabled: false };
    const engineOff = makeEngine(sms, { billing: disabled });
    const report4 = await engineOff.tick();
    const cr4 = report4.campaigns.find((r) => r.campaignId === campaignId)!;
    assert.ok(cr4.dispatched > 0);
    assert.equal(await prisma.usageRecord.count({ where: { workspaceRef: ws } }), 2);

    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "PAUSED" } });
  });

  it("the pruner deletes expired events and keeps recent ones", async () => {
    const oldId = `test-prune-old-${tag}`;
    const newId = `test-prune-new-${tag}`;
    await prisma.engineEvent.createMany({
      data: [
        {
          id: oldId,
          kind: "TICK_STARTED",
          at: new Date(Date.now() - 40 * 86_400_000),
          payload: {}
        },
        { id: newId, kind: "TICK_STARTED", at: new Date(), payload: {} }
      ]
    });

    const pruned = await createEventPruner(prisma, 30)();

    assert.ok(pruned >= 1, "at least the expired row was pruned");
    assert.equal(await prisma.engineEvent.findUnique({ where: { id: oldId } }), null);
    assert.ok(await prisma.engineEvent.findUnique({ where: { id: newId } }));
    await prisma.engineEvent.delete({ where: { id: newId } });
  });
});
