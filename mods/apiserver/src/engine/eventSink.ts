import { randomUUID } from "node:crypto";
import type { EngineEvent, EngineEventSink, ProviderEventEvent } from "@qcobro/common";
import type { EngineEventKind, PrismaClient } from "@prisma/client";
import { getLogger } from "@fonoster/logger";

const logger = getLogger({ service: "engine", filePath: import.meta.url });

/**
 * Prisma-backed flight-recorder sink plus the provider-event helper the inbound
 * webhooks use. Everything here is best-effort telemetry: failures are logged
 * and dropped, never surfaced to the tick or the webhook response.
 */

const KIND: Record<EngineEvent["kind"], EngineEventKind> = {
  "tick.started": "TICK_STARTED",
  "tick.completed": "TICK_COMPLETED",
  "campaign.evaluated": "CAMPAIGN_EVALUATED",
  "account.decided": "ACCOUNT_DECIDED",
  "attempt.reserved": "ATTEMPT_RESERVED",
  "dispatch.requested": "DISPATCH_REQUESTED",
  "dispatch.succeeded": "DISPATCH_SUCCEEDED",
  "dispatch.failed": "DISPATCH_FAILED",
  "provider.event": "PROVIDER_EVENT"
};

/** Spine fields that exist on some union members; absent ones store as null. */
type Spine = Partial<
  Record<"workspaceRef" | "campaignId" | "portfolioAccountId" | "providerRef" | "channel", string>
>;

export function createPrismaEngineEventSink(prisma: PrismaClient): EngineEventSink {
  return {
    async record(events: EngineEvent[]): Promise<void> {
      if (events.length === 0) return;
      try {
        await prisma.engineEvent.createMany({
          data: events.map((e) => {
            const s = e as Spine;
            return {
              id: e.id,
              tickId: e.tickId ?? null,
              seq: e.seq ?? null,
              kind: KIND[e.kind],
              at: new Date(e.at),
              workspaceRef: s.workspaceRef ?? null,
              campaignId: s.campaignId ?? null,
              portfolioAccountId: s.portfolioAccountId ?? null,
              providerRef: s.providerRef ?? null,
              channel: s.channel ?? null,
              payload: e as object
            };
          }),
          skipDuplicates: true
        });
      } catch (err) {
        logger.error(
          "event sink failed (dropping batch):",
          err instanceof Error ? err.message : err
        );
      }
    }
  };
}

/** The gestión lookup `recordProviderEvent` needs to attribute an inbound event. */
export interface ProviderEventPrisma {
  accountContactLog: {
    findUnique(args: {
      where: { providerRef: string };
      select: {
        campaignId: true;
        portfolioAccountId: true;
        portfolioAccount: { select: { portfolio: { select: { workspaceRef: true } } } };
      };
    }): Promise<{
      campaignId: string | null;
      portfolioAccountId: string;
      portfolioAccount: { portfolio: { workspaceRef: string } };
    } | null>;
  };
}

export interface ProviderEventInput {
  source: ProviderEventEvent["source"];
  providerRef?: string;
  /** Provider-side timestamp when the payload carries one. */
  providerAt?: string;
  /**
   * Whether the signal matched a known gestión. When omitted it is derived by
   * looking the ref up; surfaces that correlate by other means pass it explicitly.
   */
  matched?: boolean;
  /** Compact, content-free facts (event type, status, duration). */
  summary?: Record<string, string | number | boolean>;
}

/**
 * Records an inbound provider signal as a `provider.event`, attributing it to a
 * workspace/campaign/account via its gestión when the ref matches one. Callers
 * fire-and-forget after responding to the webhook — this never throws.
 */
export async function recordProviderEvent(
  prisma: ProviderEventPrisma,
  sink: EngineEventSink,
  input: ProviderEventInput
): Promise<void> {
  try {
    let workspaceRef: string | undefined;
    let campaignId: string | undefined;
    let portfolioAccountId: string | undefined;
    let matched = input.matched ?? false;
    if (input.providerRef && input.matched !== false) {
      const log = await prisma.accountContactLog.findUnique({
        where: { providerRef: input.providerRef },
        select: {
          campaignId: true,
          portfolioAccountId: true,
          portfolioAccount: { select: { portfolio: { select: { workspaceRef: true } } } }
        }
      });
      if (log) {
        matched = true;
        workspaceRef = log.portfolioAccount.portfolio.workspaceRef;
        campaignId = log.campaignId ?? undefined;
        portfolioAccountId = log.portfolioAccountId;
      } else if (input.matched === undefined) {
        matched = false;
      }
    }
    await sink.record([
      {
        id: randomUUID(),
        at: new Date().toISOString(),
        kind: "provider.event",
        source: input.source,
        providerRef: input.providerRef,
        providerAt: input.providerAt,
        matched,
        workspaceRef,
        campaignId,
        portfolioAccountId,
        summary: input.summary
      }
    ]);
  } catch (err) {
    logger.error("provider event recording failed:", err instanceof Error ? err.message : err);
  }
}

/** What an inbound handler reports about one signal (the source is pre-bound). */
export type ProviderEventRecorder = (input: Omit<ProviderEventInput, "source">) => void;

/**
 * Pre-binds source, prisma, and sink so handlers record signals with a single
 * fire-and-forget callback — no sink plumbing or error handling at call sites.
 */
export function createProviderEventRecorder(
  prisma: ProviderEventPrisma,
  sink: EngineEventSink,
  source: ProviderEventInput["source"]
): ProviderEventRecorder {
  return (input) => void recordProviderEvent(prisma, sink, { ...input, source });
}

/**
 * Bounded, best-effort pruning of expired events. Deletes in batches so the
 * first prune of a large backlog never holds one long transaction against
 * in-flight tick writes. Returns rows deleted; never throws. The runner calls
 * this at most hourly (piggybacked on a tick).
 */
export function createEventPruner(prisma: PrismaClient, retentionDays: number) {
  const BATCH = 10_000;
  return async (): Promise<number> => {
    if (retentionDays <= 0) return 0;
    try {
      const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
      let total = 0;
      for (;;) {
        const deleted = await prisma.$executeRaw`
          DELETE FROM engine_events
          WHERE id IN (SELECT id FROM engine_events WHERE at < ${cutoff} LIMIT ${BATCH})`;
        total += deleted;
        if (deleted < BATCH) break;
      }
      return total;
    } catch (err) {
      logger.error("event pruning failed:", err instanceof Error ? err.message : err);
      return 0;
    }
  };
}
