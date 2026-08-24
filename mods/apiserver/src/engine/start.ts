import { getLogger } from "@fonoster/logger";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { FonosterOutboundCallClient } from "../services/fonosterOutboundCallClient.js";
import { TwilioSmsClient } from "../services/twilioSmsClient.js";
import { ResendEmailClient } from "../services/resendEmailClient.js";
import { resolveWhatsAppClient } from "../services/resolveWhatsAppClient.js";
import { createEngine } from "./engine.js";
import { createPrismaEngineClient } from "./prismaEngineClient.js";
import { createEngineRunner, type EngineRunner } from "./runner.js";
import { createEventPruner, createPrismaEngineEventSink } from "./eventSink.js";

const logger = getLogger({ service: "engine", filePath: import.meta.url });

/**
 * Builds the campaigns engine from `qcobro.json` and starts its tick timer — but only
 * when `engine.enabled` (off in dev so it never auto-dials). Returns the runner so the
 * process can stop it on shutdown, or null when disabled.
 */
export function startEngine(): EngineRunner | null {
  if (!config.engine.enabled) {
    logger.verbose("disabled (engine.enabled = false)");
    return null;
  }

  // One instance implements both ports (OutboundCallClient + VoiceCallStatusTracker) —
  // shared so call-status tracking reuses the same authenticated Fonoster client/login
  // rather than a second one.
  const fonosterCallClient = config.fonoster
    ? new FonosterOutboundCallClient(config.fonoster)
    : null;

  const engine = createEngine({
    db: createPrismaEngineClient(prisma),
    reserveRecordClient: prisma,
    outboundCallClient: fonosterCallClient,
    voiceCallStatusTracker: fonosterCallClient,
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
    voicePerMinute: config.fonoster?.maxCallsPerMinute ?? 0,
    smsPerMinute: config.twilio?.maxSmsPerMinute ?? 0,
    emailPerMinute: config.resend?.maxEmailsPerMinute ?? 0,
    whatsAppPerMinute: config.whatsapp.maxMessagesPerMinute,
    resolveWhatsApp: (workspaceRef, phoneNumberId) =>
      resolveWhatsAppClient(prisma as never, workspaceRef, config.whatsapp, phoneNumberId),
    tickSeconds: config.engine.tickSeconds,
    billing: config.billing,
    consecutiveSystemErrorPauseThreshold: config.engine.consecutiveSystemErrorPauseThreshold
  });

  const runner = createEngineRunner({
    prisma,
    tick: engine.tick,
    tickSeconds: config.engine.tickSeconds,
    eventSink: createPrismaEngineEventSink(prisma),
    pruneEvents:
      config.engine.eventsRetentionDays > 0
        ? createEventPruner(prisma, config.engine.eventsRetentionDays)
        : null,
    maxTickMs: config.engine.maxTickMs
  });
  runner.start();
  logger.verbose(`started — tick every ${config.engine.tickSeconds}s`);
  return runner;
}
