import { config } from "../config.js";
import { prisma } from "../db.js";
import { FonosterOutboundCallClient } from "../services/fonosterOutboundCallClient.js";
import { TwilioSmsClient } from "../services/twilioSmsClient.js";
import { ResendEmailClient } from "../services/resendEmailClient.js";
import { createEngine } from "./engine.js";
import { createPrismaEngineClient } from "./prismaEngineClient.js";
import { createEngineRunner, type EngineRunner } from "./runner.js";

/**
 * Builds the campaigns engine from `qcobro.json` and starts its tick timer — but only
 * when `engine.enabled` (off in dev so it never auto-dials). Returns the runner so the
 * process can stop it on shutdown, or null when disabled.
 */
export function startEngine(): EngineRunner | null {
  if (!config.engine.enabled) {
    console.log("[engine] disabled (engine.enabled = false)");
    return null;
  }

  const engine = createEngine({
    db: createPrismaEngineClient(prisma),
    reserveRecordClient: prisma,
    outboundCallClient: config.fonoster ? new FonosterOutboundCallClient(config.fonoster) : null,
    smsClient: config.twilio ? new TwilioSmsClient(config.twilio) : null,
    emailClient: config.resend ? new ResendEmailClient(config.resend) : null,
    emailFrom: config.resend
      ? {
          email: config.resend.fromEmail,
          name: config.resend.fromName,
          inboundDomain: config.resend.inboundDomain
        }
      : null,
    fonosterNumbers: config.fonoster?.numbers ?? [],
    twilioFromNumbers: config.twilio?.fromNumbers ?? [],
    fonosterPrerecordedAppRef: config.fonoster?.prerecordedAppRef ?? null,
    clock: { now: () => new Date() },
    timezone: config.timezone,
    voicePerMinute: config.fonoster?.maxCallsPerMinute ?? 0,
    smsPerMinute: config.twilio?.maxSmsPerMinute ?? 0,
    emailPerMinute: config.resend?.maxEmailsPerMinute ?? 0,
    tickSeconds: config.engine.tickSeconds
  });

  const runner = createEngineRunner({
    prisma,
    tick: engine.tick,
    tickSeconds: config.engine.tickSeconds
  });
  runner.start();
  console.log(`[engine] started — tick every ${config.engine.tickSeconds}s`);
  return runner;
}
