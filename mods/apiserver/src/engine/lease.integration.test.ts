import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createEngineLease, LEASE_ID } from "./lease.js";
import { createEngineRunner } from "./runner.js";
import type { TickReport } from "@qcobro/common";

// Needs a real Postgres — the whole point is behavior under Prisma's connection pool,
// which no mock reproduces. Skipped unless DATABASE_URL is set.
const RUN = !!process.env.DATABASE_URL;

const ADVISORY_LOCK_KEY = 4242_0001;

/**
 * Append a connection parameter without assuming the URL has no query string — the
 * documented dev URL carries `?schema=public` and managed Postgres needs `?sslmode=require`,
 * so naive `?key=value` concatenation produces an unparseable connection string.
 */
const withParam = (url: string, param: string) =>
  `${url}${url.includes("?") ? "&" : "?"}${param}`;

describe("engine lease (integration)", { skip: !RUN ? "no DATABASE_URL" : false }, () => {
  const prisma = new PrismaClient();

  const emptyReport = () =>
    ({ at: new Date().toISOString(), campaigns: [], events: [] }) as unknown as TickReport;

  before(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  beforeEach(async () => {
    await prisma.engineLease.deleteMany({ where: { id: LEASE_ID } });
  });

  after(async () => {
    await prisma.engineLease.deleteMany({ where: { id: LEASE_ID } });
    await prisma.$disconnect();
  });

  it("claims when free, renews for the holder, and refuses a peer while unexpired", async () => {
    const a = createEngineLease(prisma, { ttlSeconds: 60, holder: "instance-a" });
    const b = createEngineLease(prisma, { ttlSeconds: 60, holder: "instance-b" });

    assert.equal(await a.acquire(), true, "free lease is claimed");
    assert.equal(await a.acquire(), true, "the holder renews rather than blocking itself");
    assert.equal(await b.acquire(), false, "a peer cannot steal an unexpired lease");

    const row = await prisma.engineLease.findUnique({ where: { id: LEASE_ID } });
    assert.equal(row?.holder, "instance-a", "a refused claim leaves the holder untouched");
  });

  it("lets a peer take over once the lease expires — the crashed-holder path", async () => {
    // ttl 0 is clamped to 1s by createEngineLease, so expire the row directly instead:
    // this is the state a process that died mid-tick leaves behind.
    const dead = createEngineLease(prisma, { ttlSeconds: 60, holder: "dead-instance" });
    assert.equal(await dead.acquire(), true);
    await prisma.engineLease.update({
      where: { id: LEASE_ID },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    const successor = createEngineLease(prisma, { ttlSeconds: 60, holder: "successor" });
    assert.equal(await successor.acquire(), true, "an expired lease is claimable");

    const row = await prisma.engineLease.findUnique({ where: { id: LEASE_ID } });
    assert.equal(row?.holder, "successor");
  });

  it("release hands over immediately, and only the holder may release", async () => {
    const a = createEngineLease(prisma, { ttlSeconds: 3600, holder: "instance-a" });
    const b = createEngineLease(prisma, { ttlSeconds: 3600, holder: "instance-b" });
    await a.acquire();

    await b.release(); // not the holder — must be a no-op
    assert.equal(await b.acquire(), false, "a non-holder's release does not free the lease");

    await a.release();
    assert.equal(await b.acquire(), true, "after the holder releases, a peer takes over at once");
  });

  it("survives the connection-pool hop that broke the advisory lock", async () => {
    // The regression this whole change exists for. Establishing it as a real defect first:
    // pg_try_advisory_lock is SESSION scoped, so acquiring on one pooled connection and
    // releasing on another silently fails and strands the lock.
    const url = process.env.DATABASE_URL!;
    const one = new PrismaClient({ datasources: { db: { url: withParam(url, "connection_limit=1") } } });
    const two = new PrismaClient({ datasources: { db: { url: withParam(url, "connection_limit=1") } } });
    try {
      const [locked] = await one.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked`;
      assert.equal(locked.locked, true);
      const [released] = await two.$queryRaw<
        { released: boolean }[]
      >`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY}) AS released`;
      assert.equal(released.released, false, "unlock from another session silently fails…");
      const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_locks
        WHERE locktype = 'advisory' AND classid = 0 AND objid = ${ADVISORY_LOCK_KEY}`;
      assert.equal(n, 1, "…and the lock stays held by the acquiring session");
    } finally {
      // Disconnecting the holder is what actually frees it — in production this was the
      // pool recycling a connection, which is why stalls ended at arbitrary moments.
      await one.$disconnect();
      await two.$disconnect();
    }

    // The lease has no such affinity: two independent clients (guaranteed different
    // sessions) agree on who holds it.
    const clientA = new PrismaClient({ datasources: { db: { url: withParam(url, "connection_limit=1") } } });
    const clientB = new PrismaClient({ datasources: { db: { url: withParam(url, "connection_limit=1") } } });
    try {
      const a = createEngineLease(clientA, { ttlSeconds: 60, holder: "instance-a" });
      const b = createEngineLease(clientB, { ttlSeconds: 60, holder: "instance-b" });
      assert.equal(await a.acquire(), true);
      assert.equal(await b.acquire(), false, "a peer on a different session is still refused");
      await a.release();
      assert.equal(await b.acquire(), true, "and a release on one session frees it on another");
    } finally {
      await clientA.$disconnect();
      await clientB.$disconnect();
    }
  });

  it("keeps ticking across many runs under concurrent pool traffic", async () => {
    // The production symptom, as a test: with the advisory lock this pattern skipped 11 of
    // 12 ticks because the unlock kept landing on a different pooled connection. The tick
    // body issues concurrent queries, which is what scatters them across the pool.
    const url = process.env.DATABASE_URL!;
    const client = new PrismaClient({ datasources: { db: { url: withParam(url, "connection_limit=5") } } });
    try {
      let ticks = 0;
      const runner = createEngineRunner({
        prisma: client,
        tickSeconds: 60,
        leaseTtlSeconds: 60,
        log: () => undefined,
        tick: async () => {
          ticks++;
          await Promise.all(
            Array.from({ length: 8 }, () => client.$queryRaw`SELECT pg_sleep(0.01)::text AS x`)
          );
          return emptyReport();
        }
      });

      for (let i = 0; i < 12; i++) await runner.runOnce();

      assert.equal(ticks, 12, "every scheduled tick ran — none silently skipped");
      await runner.stop();
    } finally {
      await client.$disconnect();
    }
  });
});
