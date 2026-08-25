import { randomUUID } from "node:crypto";

/**
 * The engine's single-writer guard, as a row rather than a session-scoped advisory lock.
 *
 * Why not `pg_try_advisory_lock`: advisory locks belong to a Postgres *session*, but Prisma
 * routes each `$queryRaw` to an arbitrary connection from its pool. Acquiring on one
 * connection and releasing on another makes `pg_advisory_unlock` return `false` — a warning,
 * never an error — leaving the lock held by a connection that is idle but very much alive.
 * From then on a tick only ran when its lock query happened to land back on that same
 * connection; every other tick returned having done nothing, with no log and no event. In
 * production this silently cost multi-minute to multi-hour stretches of dispatch, ending
 * only when the pool recycled the holding connection.
 *
 * A lease row has none of that connection affinity: any connection can read and write it, so
 * claim and renewal are unaffected by which one the pool hands out. A holder that dies simply
 * stops renewing and the lease expires, which is also the failover path across instances.
 *
 * Note this is deliberately *not* released after each tick — the holder renews it, so a
 * healthy instance keeps ticking and peers stay quiet. It is released on graceful shutdown so
 * a redeploy fails over immediately rather than waiting out the TTL.
 */

/** The single row's primary key; the table holds exactly one. */
export const LEASE_ID = "engine";

/** The `$queryRaw` surface this needs — satisfied structurally by the Prisma client. */
export interface LeaseClient {
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

export interface EngineLease {
  /**
   * Claim the lease, or renew it when already held by this instance. `false` means a
   * different instance holds an unexpired lease and this process must not tick.
   */
  acquire(): Promise<boolean>;
  /** Expire this instance's lease so a peer can take over without waiting out the TTL. */
  release(): Promise<void>;
  /** This process's opaque identity, for logging. */
  readonly holder: string;
}

export interface EngineLeaseOptions {
  /**
   * How long a claim stays valid without renewal. Must exceed the longest plausible tick,
   * or a peer could claim the lease mid-tick and two instances would dispatch at once. It
   * is also the failover delay after an ungraceful exit, so it trades those two off.
   */
  ttlSeconds: number;
  /** Overridable for tests; defaults to a per-process UUID. */
  holder?: string;
}

export function createEngineLease(client: LeaseClient, opts: EngineLeaseOptions): EngineLease {
  const holder = opts.holder ?? randomUUID();
  const ttlSeconds = Math.max(1, opts.ttlSeconds);

  return {
    holder,

    async acquire(): Promise<boolean> {
      // One statement, so the check and the claim cannot interleave with a peer's. The
      // WHERE on the conflict path is what makes it safe: an unexpired lease held by
      // someone else updates nothing and returns no rows.
      const rows = await client.$queryRaw<{ holder: string }[]>`
        INSERT INTO engine_lease (id, holder, "expiresAt")
        VALUES (${LEASE_ID}, ${holder}, now() + make_interval(secs => ${ttlSeconds}))
        ON CONFLICT (id) DO UPDATE
           SET holder = EXCLUDED.holder,
               "expiresAt" = EXCLUDED."expiresAt"
         WHERE engine_lease."expiresAt" <= now()
            OR engine_lease.holder = EXCLUDED.holder
        RETURNING holder`;
      return rows.length > 0;
    },

    async release(): Promise<void> {
      // Scoped to this holder so a late release can never expire a peer's fresh claim.
      await client.$queryRaw`
        UPDATE engine_lease
           SET "expiresAt" = now()
         WHERE id = ${LEASE_ID} AND holder = ${holder}`;
    }
  };
}
