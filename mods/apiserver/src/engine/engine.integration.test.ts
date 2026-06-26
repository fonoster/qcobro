import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createEngine } from "./engine.js";
import { createPrismaEngineClient } from "./prismaEngineClient.js";
import { EmulatedSmsClient } from "./emulators.js";

// Integration tests need a real Postgres. Skipped unless DATABASE_URL is set
// (the dev stack: `docker compose -f compose.dev.yaml up -d db`).
const RUN = !!process.env.DATABASE_URL;

const TZ = "America/Costa_Rica";
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
      data: { workspaceRef: ws, name: "PF", clientId: `cli-${tag}`, currency: "USD" }
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

  function makeEngine(sms: EmulatedSmsClient) {
    return createEngine({
      db: createPrismaEngineClient(prisma),
      reserveRecordClient: prisma,
      outboundCallClient: null,
      smsClient: sms,
      fonosterNumbers: [],
      twilioFromNumbers: ["+15550009999"],
      fonosterPrerecordedAppRef: null,
      clock: { now: () => NOW },
      timezone: TZ,
      voicePerMinute: 0,
      smsPerMinute: 60,
      emailPerMinute: 0,
      tickSeconds: 60
    });
  }

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
});
