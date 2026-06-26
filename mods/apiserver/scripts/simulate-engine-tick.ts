/**
 * Dev tool: run ONE campaigns-engine tick in simulation and print what happened.
 *
 * It runs the REAL engine against your configured database (real reservations and
 * gestiones are written), but swaps the channels for EMULATORS — so nothing is ever
 * dialed or texted. This is the spec's "simulation": real DB writes, channel faked.
 *
 *   npm run engine:sim --workspace=mods/apiserver
 *
 * Seed a campaign first (console: create a portfolio + SMS/voice agent + an ACTIVE
 * campaign whose window covers now), then run this and watch the TickReport. Run it
 * again to see at-most-once (the account is skipped by the daily cap).
 */
import { config } from "../src/config.js";
import { prisma } from "../src/db.js";
import { createEngine } from "../src/engine/engine.js";
import { createPrismaEngineClient } from "../src/engine/prismaEngineClient.js";
import { EmulatedOutboundCallClient, EmulatedSmsClient } from "../src/engine/emulators.js";

async function main(): Promise<void> {
  const voice = new EmulatedOutboundCallClient();
  const sms = new EmulatedSmsClient();

  const engine = createEngine({
    db: createPrismaEngineClient(prisma),
    reserveRecordClient: prisma,
    // Emulators in place of Fonoster/Twilio — records would-be dispatches, sends nothing.
    outboundCallClient: voice,
    smsClient: sms,
    // Non-empty pools so readiness passes; the emulator ignores the actual numbers.
    fonosterNumbers: config.fonoster?.numbers?.length ? config.fonoster.numbers : ["+10000000000"],
    twilioFromNumbers: config.twilio?.fromNumbers?.length
      ? config.twilio.fromNumbers
      : ["+10000000001"],
    fonosterPrerecordedAppRef: config.fonoster?.prerecordedAppRef ?? "sim-prerecorded-app",
    clock: { now: () => new Date() },
    timezone: config.timezone,
    voicePerMinute: config.fonoster?.maxCallsPerMinute ?? 6,
    smsPerMinute: config.twilio?.maxSmsPerMinute ?? 60,
    tickSeconds: config.engine.tickSeconds
  });

  const report = await engine.tick();

  // Resolve names so the report reads clearly (the TickReport carries only IDs).
  const campaignIds = report.campaigns.map((c) => c.campaignId);
  const accountIds = [
    ...new Set(report.campaigns.flatMap((c) => c.decisions.map((d) => d.portfolioAccountId)))
  ];
  const campaignName = new Map(
    (
      await prisma.campaign.findMany({
        where: { id: { in: campaignIds } },
        select: { id: true, name: true }
      })
    ).map((c) => [c.id, c.name])
  );
  const accountName = new Map(
    (
      await prisma.portfolioAccount.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, fullName: true }
      })
    ).map((a) => [a.id, a.fullName])
  );

  console.log(`\n=== Engine simulation tick @ ${report.at}  (tz ${config.timezone}) ===`);
  if (report.campaigns.length === 0) {
    console.log("No ACTIVE campaigns found. Seed one (npm run db:seed), then re-run.\n");
  }
  for (const c of report.campaigns) {
    const head = c.completed
      ? "→ auto-completed (past endDate)"
      : c.skipReason
        ? `skipped: ${c.skipReason}`
        : `in-window  dispatched=${c.dispatched} suppressed=${c.suppressed} skipped=${c.skipped}`;
    console.log(`\n${campaignName.get(c.campaignId) ?? c.campaignId}  ${head}`);
    for (const d of c.decisions) {
      const who = accountName.get(d.portfolioAccountId) ?? d.portfolioAccountId;
      console.log(`    ${who}: ${d.decision}${d.providerRef ? ` (${d.providerRef})` : ""}`);
    }
  }

  const dispatches = [...voice.calls, ...sms.messages];
  console.log(`\nWould-be dispatches (EMULATED — nothing was actually sent): ${dispatches.length}`);
  for (const d of dispatches) {
    const detail = d.channel === "sms" ? JSON.stringify(d.body) : `appRef=${d.appRef}`;
    console.log(`    [${d.channel}] ${d.ref} -> ${d.to}  ${detail}`);
  }
  console.log("");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
