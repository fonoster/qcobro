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
 *
 * Flight recorder: each tick's events are persisted to `engine_events` (the same
 * sink production uses), so a sim run can be judged with `engine-eval`.
 *
 * Env knobs:
 *   SIM_AT     ISO datetime the engine clock reports (default: now). Use it to run
 *              inside a campaign window regardless of wall-clock time.
 *   SIM_TICKS  number of consecutive ticks to run (default: 1).
 */
import { config } from "../src/config.js";
import { prisma } from "../src/db.js";
import type { TickReport } from "@qcobro/common";
import { createEngine } from "../src/engine/engine.js";
import { createEngineRunner } from "../src/engine/runner.js";
import { createPrismaEngineClient } from "../src/engine/prismaEngineClient.js";
import { createPrismaEngineEventSink } from "../src/engine/eventSink.js";
import { resolveWhatsAppClient } from "../src/services/resolveWhatsAppClient.js";
import {
  EmulatedOutboundCallClient,
  EmulatedSmsClient,
  EmulatedEmailClient
} from "../src/engine/emulators.js";

async function main(): Promise<void> {
  const voice = new EmulatedOutboundCallClient();
  const sms = new EmulatedSmsClient();
  const email = new EmulatedEmailClient();

  const simAt = process.env.SIM_AT ? new Date(process.env.SIM_AT) : null;
  if (simAt && Number.isNaN(simAt.getTime()))
    throw new Error(`Invalid SIM_AT: ${process.env.SIM_AT}`);
  const simTicks = Math.max(1, Number(process.env.SIM_TICKS ?? 1) || 1);

  const engine = createEngine({
    db: createPrismaEngineClient(prisma),
    reserveRecordClient: prisma,
    // Emulators in place of Fonoster/Twilio/Resend — records would-be dispatches, sends nothing.
    outboundCallClient: voice,
    smsClient: sms,
    emailClient: email,
    // Non-empty pools/identity so readiness passes; the emulator ignores the actual values.
    fonosterNumbers: config.fonoster?.numbers?.length ? config.fonoster.numbers : ["+10000000000"],
    twilioFromNumbers: config.twilio?.fromNumbers?.length
      ? config.twilio.fromNumbers
      : ["+10000000001"],
    emailFrom: config.resend
      ? {
          email: config.resend.fromEmail,
          name: config.resend.fromName,
          inboundDomain: config.resend.inboundDomain
        }
      : { email: "cobranza@sim.local", inboundDomain: "sim.local" },
    fonosterPrerecordedAppRef: config.fonoster?.prerecordedAppRef ?? "sim-prerecorded-app",
    clock: { now: () => simAt ?? new Date() },
    voicePerMinute: config.fonoster?.maxCallsPerMinute ?? 6,
    smsPerMinute: config.twilio?.maxSmsPerMinute ?? 60,
    emailPerMinute: config.resend?.maxEmailsPerMinute ?? 60,
    whatsAppPerMinute: config.whatsapp.maxMessagesPerMinute,
    resolveWhatsApp: (workspaceRef, phoneNumberId) =>
      resolveWhatsAppClient(prisma as never, workspaceRef, config.whatsapp, phoneNumberId),
    tickSeconds: config.engine.tickSeconds
  });

  // Drive ticks through the production runner so the sim gets the identical
  // flush/prune/lock behavior by construction (not by manual upkeep); the log
  // callback captures each report for the display below.
  let report: TickReport | undefined;
  let recordedEvents = 0;
  const runner = createEngineRunner({
    prisma,
    tick: engine.tick,
    tickSeconds: config.engine.tickSeconds,
    eventSink: createPrismaEngineEventSink(prisma),
    log: (r) => {
      report = r;
      recordedEvents += r.events?.length ?? 0;
    }
  });
  for (let i = 0; i < simTicks; i++) await runner.runOnce();
  if (!report) {
    throw new Error("No tick ran — another apiserver instance holds the engine advisory lock");
  }

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

  console.log(
    `\n=== Engine simulation @ ${report.at} — ${simTicks} tick(s), last shown; ` +
      `${recordedEvents} event(s) recorded to engine_events ===`
  );
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

  const dispatches = [...voice.calls, ...sms.messages, ...email.emails];
  console.log(`\nWould-be dispatches (EMULATED — nothing was actually sent): ${dispatches.length}`);
  for (const d of dispatches) {
    const detail =
      d.channel === "voice"
        ? `appRef=${d.appRef}`
        : d.channel === "email"
          ? `subj=${JSON.stringify(d.subject)} reply-to=${d.replyTo}`
          : JSON.stringify(d.body);
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
