import type { ContactLogTouch, RecoveryContext, RecoveryCreate } from "@qcobro/common";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The `AccountContactLog` fields a snapshot reads. */
export const CONTACT_LOG_TOUCH_SELECT = {
  id: true,
  portfolioAccountId: true,
  campaignId: true,
  campaign: { select: { name: true } },
  agentType: true,
  delivery: true,
  path: true,
  outcome: true,
  contactedAt: true
} as const;

/**
 * What was happening with one account between two syncs: its gestiones with `contactedAt` in
 * `(previousSyncAt, detectedAt]`. `logs` may hold other accounts' or out-of-range gestiones;
 * they are filtered out here.
 */
export function buildRecoveryContext(
  logs: ContactLogTouch[],
  portfolioAccountId: string,
  previousSyncAt: Date,
  detectedAt: Date
): RecoveryContext {
  const touches = logs.filter(
    (l) =>
      l.portfolioAccountId === portfolioAccountId &&
      l.contactedAt.getTime() > previousSyncAt.getTime() &&
      l.contactedAt.getTime() <= detectedAt.getTime()
  );
  const ordered = [...touches].sort((a, b) => a.contactedAt.getTime() - b.contactedAt.getTime());
  const campaigns = new Map<string, string>();
  for (const t of ordered) {
    if (t.campaignId && !campaigns.has(t.campaignId)) {
      campaigns.set(t.campaignId, t.campaign?.name ?? "");
    }
  }
  const last = ordered.at(-1);
  return {
    hasGestion: touches.length > 0,
    touches: touches.length,
    activeCampaigns: [...campaigns].map(([id, name]) => ({ id, name })),
    lastTouch: last
      ? {
          contactLogId: last.id,
          agentType: last.agentType,
          delivery: last.delivery,
          path: last.path,
          outcome: last.outcome,
          contactedAt: last.contactedAt.toISOString()
        }
      : null,
    daysSinceLastTouch: last
      ? Math.floor((detectedAt.getTime() - last.contactedAt.getTime()) / DAY_MS)
      : null
  };
}

/** The Recovery columns copied from its context, so reports can filter and group on them. */
export function contextColumns(
  context: RecoveryContext
): Pick<
  RecoveryCreate,
  "hasGestion" | "lastTouchAgentType" | "lastTouchOutcome" | "daysSinceLastTouch" | "campaignIds"
> {
  return {
    hasGestion: context.hasGestion,
    lastTouchAgentType: context.lastTouch?.agentType ?? null,
    lastTouchOutcome: context.lastTouch?.outcome ?? null,
    daysSinceLastTouch: context.daysSinceLastTouch,
    campaignIds: context.activeCampaigns.map((c) => c.id)
  };
}
