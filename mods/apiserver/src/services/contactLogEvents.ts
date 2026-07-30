import { EventEmitter } from "node:events";
import { getLogger } from "@fonoster/logger";

const logger = getLogger({ service: "apiserver", filePath: import.meta.url });

/**
 * A change signal for one gestión: something about `AccountContactLog` id `id` (or a
 * `PaymentPromise` linked to it) changed. Carries no row data — subscribers refetch
 * via the same workspace-scoped tRPC query the fallback path already uses.
 */
export interface ContactLogChangeEvent {
  id: string;
  workspaceRef: string;
}

export const CONTACT_LOG_CHANGED = "contactLogChanged";

/**
 * In-process pub/sub bus for gestión/payment-promise change signals (realtime-streaming
 * capability). Fed by the Prisma extension in `db.ts`, consumed by the
 * `campaigns.contactLog.onChange` tRPC subscription. Single apiserver instance only — see
 * design.md for the horizontal-scaling follow-up.
 */
export const contactLogEvents = new EventEmitter();
// Many concurrent WS subscribers (one per open Gestiones list / Gestión detail) is expected
// and not a leak; raise the default cap so Node doesn't warn.
contactLogEvents.setMaxListeners(0);

export function emitContactLogChanged(event: ContactLogChangeEvent): void {
  contactLogEvents.emit(CONTACT_LOG_CHANGED, event);
}

/** The lookup {@link contactLogEventsExtension} needs to resolve a write's workspace. */
export interface ContactLogEventsPrisma {
  portfolioAccount: {
    findUnique(args: {
      where: { id: string };
      select: { portfolio: { select: { workspaceRef: true } } };
    }): Promise<{ portfolio: { workspaceRef: string } } | null>;
  };
}

/**
 * Resolves `portfolioAccountId`'s owning workspace and emits the signal. Deliberately reads
 * `PortfolioAccount` — not `AccountContactLog` (or, for a promise, back through its contact
 * log) — because the write that triggered this may still be inside an open interactive
 * transaction (`recordOutcomeTx` et al. run inside `$transaction`): a fresh lookup on the
 * row that transaction is *currently writing* would not see it yet (it isn't committed),
 * silently dropping the signal. `PortfolioAccount` is never part of that write set, so this
 * lookup is always safe to run immediately, on a separate connection, mid-transaction.
 */
async function resolveAndEmit(
  base: ContactLogEventsPrisma,
  contactLogId: string | undefined,
  portfolioAccountId: string | undefined
): Promise<void> {
  if (!contactLogId || !portfolioAccountId) return;
  try {
    const account = await base.portfolioAccount.findUnique({
      where: { id: portfolioAccountId },
      select: { portfolio: { select: { workspaceRef: true } } }
    });
    if (account) {
      emitContactLogChanged({ id: contactLogId, workspaceRef: account.portfolio.workspaceRef });
    }
  } catch (err) {
    // Best-effort: a failed lookup only means an operator misses one live update — the
    // fallback refetch path still shows the write next time the screen is opened/navigated.
    logger.error(
      "contact-log change signal lookup failed (dropping):",
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Prisma Client Extension: after a successful `create`/`update`/`upsert` on
 * `accountContactLog` or `paymentPromise`, emits a change signal on {@link contactLogEvents}
 * for the affected gestión. Every existing (and future) write path to these two models is
 * covered without instrumenting each call site — see design.md for the rationale.
 *
 * `base` MUST be the non-extended client, so the lookup query this extension performs does
 * not re-enter itself.
 */
export function contactLogEventsExtension(base: ContactLogEventsPrisma) {
  const WRITE_OPS = new Set(["create", "update", "upsert"]);
  return {
    name: "contactLogEvents",
    query: {
      accountContactLog: {
        async $allOperations({
          operation,
          args,
          query
        }: {
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          const result = await query(args);
          if (WRITE_OPS.has(operation)) {
            const row = result as { id?: string; portfolioAccountId?: string } | null;
            await resolveAndEmit(base, row?.id, row?.portfolioAccountId);
          }
          return result;
        }
      },
      paymentPromise: {
        async $allOperations({
          operation,
          args,
          query
        }: {
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          const result = await query(args);
          if (WRITE_OPS.has(operation)) {
            const row = result as { contactLogId?: string; portfolioAccountId?: string } | null;
            await resolveAndEmit(base, row?.contactLogId, row?.portfolioAccountId);
          }
          return result;
        }
      }
    }
  };
}
