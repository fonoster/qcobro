import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSyncAccounts } from "./syncAccounts.js";
import { ValidationError } from "@qcobro/common";
import type { SyncAccountsClient, SyncResult } from "@qcobro/common";

type Row = Record<string, unknown>;

const DAY = 24 * 60 * 60 * 1000;

const BASE_ROW = {
  externalId: "C001",
  fullName: "Ana García",
  outstandingBalance: 1000,
  principalAmount: 1200,
  termsAmount: 100,
  termsLength: 12,
  daysPastDue: 30,
  missedInstallments: 1
};

/** Matches a stored row against the subset of Prisma `where` syntax the sync uses. */
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond === null) return value === null || value === undefined;
    if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
    if (typeof cond === "object") {
      const c = cond as Row;
      if ("in" in c) return (c.in as unknown[]).includes(value);
      if ("gt" in c || "lte" in c) {
        const t = (value as Date).getTime();
        if (c.gt && !(t > (c.gt as Date).getTime())) return false;
        if (c.lte && !(t <= (c.lte as Date).getTime())) return false;
        return true;
      }
      return matches(value as Row, c);
    }
    return value === cond;
  });
}

interface Seed {
  accounts?: Row[];
  exits?: Row[];
  logs?: Row[];
  promises?: Row[];
}

let seq = 0;

function account(externalId: string, fields: Row = {}): Row {
  return {
    id: `acc-${externalId}`,
    portfolioId: "p1",
    externalId,
    fullName: "Test",
    outstandingBalance: 1000,
    termsAmount: 100,
    missedInstallments: 3,
    archivedAt: null,
    lastSyncedAt: new Date(Date.now() - 7 * DAY),
    createdAt: new Date(Date.now() - 30 * DAY),
    ...fields
  };
}

function promise(accountExternalId: string, fields: Row = {}): Row {
  return {
    id: `pr-${++seq}`,
    portfolioAccountId: `acc-${accountExternalId}`,
    status: "PENDING",
    expiredByExitId: null,
    ...fields
  };
}

/** An in-memory stand-in for the Prisma transaction, honouring every `where` it receives. */
function makeDb(seed: Seed = {}) {
  const db = {
    accounts: (seed.accounts ?? []).map((a) => ({ ...a })),
    exits: (seed.exits ?? []).map((e) => ({ ...e })),
    recoveries: [] as Row[],
    logs: (seed.logs ?? []).map((l) => ({ ...l })),
    promises: (seed.promises ?? []).map((p) => ({ ...p })),
    locks: [] as unknown[],
    created: [] as Row[],
    portfolioUpdate: null as Row | null,
    timeout: undefined as number | undefined
  };

  const tx = {
    $queryRaw: async (_q: TemplateStringsArray, ...values: unknown[]) => {
      db.locks.push(values[0]);
      return [];
    },
    portfolio: {
      update: async (args: { data: Row }) => {
        db.portfolioUpdate = args.data;
        return { id: "p1" };
      }
    },
    portfolioAccount: {
      findMany: async (args: { where: Row }) =>
        db.accounts.filter((a) => matches(a, args.where)).map((a) => ({ ...a })),
      count: async (args: { where: Row }) =>
        db.accounts.filter((a) => matches(a, args.where)).length,
      aggregate: async (args: { where: Row }) => ({
        _sum: {
          outstandingBalance: db.accounts
            .filter((a) => matches(a, args.where))
            .reduce((s, a) => s + (a.outstandingBalance as number), 0)
        }
      }),
      create: async (args: { data: Row }) => {
        const acc = { id: `acc-${args.data.externalId}`, createdAt: new Date(), ...args.data };
        db.accounts.push(acc);
        db.created.push(args.data);
        return acc;
      },
      update: async (args: {
        where: { portfolioId_externalId: { externalId: string } };
        data: Row;
      }) => {
        const acc = db.accounts.find(
          (a) => a.externalId === args.where.portfolioId_externalId.externalId
        )!;
        Object.assign(acc, args.data);
        return acc;
      },
      updateMany: async (args: { where: Row; data: Row }) => {
        const hit = db.accounts.filter((a) => matches(a, args.where));
        hit.forEach((a) => Object.assign(a, args.data));
        return { count: hit.length };
      }
    },
    accountExit: {
      findMany: async (args: { where: Row }) =>
        db.exits
          .filter((e) => matches(e, args.where))
          .sort((a, b) => (b.exitedAt as Date).getTime() - (a.exitedAt as Date).getTime()),
      createMany: async (args: { data: Row[] }) => {
        args.data.forEach((e) => db.exits.push({ classifiedAt: null, reenteredAt: null, ...e }));
        return { count: args.data.length };
      },
      updateMany: async (args: { where: Row; data: Row }) => {
        const hit = db.exits.filter((e) => matches(e, args.where));
        hit.forEach((e) => Object.assign(e, args.data));
        return { count: hit.length };
      }
    },
    recovery: {
      createMany: async (args: { data: Row[] }) => {
        db.recoveries.push(...args.data);
        return { count: args.data.length };
      }
    },
    accountContactLog: {
      findMany: async (args: { where: Row }) => db.logs.filter((l) => matches(l, args.where))
    },
    paymentPromise: {
      findMany: async (args: { where: Row }) => db.promises.filter((p) => matches(p, args.where)),
      updateMany: async (args: { where: Row; data: Row }) => {
        const hit = db.promises.filter((p) => matches(p, args.where));
        hit.forEach((p) => Object.assign(p, args.data));
        return { count: hit.length };
      }
    }
  };

  const client: SyncAccountsClient = {
    $transaction: async (fn, options) => {
      db.timeout = options?.timeout;
      return fn(tx as never);
    }
  };
  return { client, db };
}

function sync(t: ReturnType<typeof makeDb>, input: Row): Promise<SyncResult> {
  return createSyncAccounts(t.client)({ portfolioId: "p1", ...input });
}

const row = (externalId: string, fields: Row = {}) => ({ ...BASE_ROW, externalId, ...fields });

describe("syncAccounts", () => {
  describe("accounts", () => {
    it("creates new accounts in APPEND_ONLY mode and updates portfolio totals", async () => {
      const t = makeDb();
      const result = await sync(t, { mode: "APPEND_ONLY", rows: [row("C001"), row("C002")] });
      assert.equal(result.created, 2);
      assert.equal(result.total, 2);
      assert.equal(t.db.portfolioUpdate?.accountCount, 2);
      assert.equal(t.db.portfolioUpdate?.totalOutstandingBalance, 2000);
      assert.ok(t.db.portfolioUpdate?.lastSyncedAt instanceof Date);
    });

    it("updates existing accounts in UPDATE_EXISTING mode", async () => {
      const t = makeDb({ accounts: [account("C001")] });
      const result = await sync(t, {
        mode: "UPDATE_EXISTING",
        rows: [row("C001", { outstandingBalance: 800 })]
      });
      assert.equal(result.updated, 1);
      assert.equal(t.db.accounts[0]!.outstandingBalance, 800);
    });

    it("does NOT archive in APPEND_ONLY mode even if accounts are missing from the file", async () => {
      const t = makeDb({ accounts: [account("C001"), account("C002")] });
      const result = await sync(t, { mode: "APPEND_ONLY", rows: [row("C003")] });
      assert.equal(result.archived, 0);
      assert.equal(t.db.exits.length, 0);
    });

    it("empties the portfolio when REPLACE is called with an empty batch", async () => {
      const t = makeDb({ accounts: [account("C001"), account("C002")] });
      const result = await sync(t, { mode: "REPLACE", rows: [] });
      assert.equal(result.archived, 2);
      assert.equal(result.total, 0);
      assert.equal(t.db.portfolioUpdate?.accountCount, 0);
    });

    it("REPLACE with an empty batch on an already-empty portfolio archives nothing", async () => {
      const t = makeDb();
      const result = await sync(t, { mode: "REPLACE", rows: [] });
      assert.equal(result.archived, 0);
      assert.equal(result.total, 0);
    });

    it("throws ValidationError when rows and exits are both empty outside REPLACE", async () => {
      for (const mode of ["APPEND_ONLY", "UPDATE_EXISTING"] as const) {
        const t = makeDb({ accounts: [account("C001")] });
        await assert.rejects(sync(t, { mode, rows: [] }), ValidationError);
        assert.equal(t.db.portfolioUpdate, null);
      }
    });

    it("locks the portfolio row and gives the transaction an explicit timeout", async () => {
      const t = makeDb();
      await sync(t, { mode: "APPEND_ONLY", rows: [row("C001")] });
      assert.deepEqual(t.db.locks, ["p1"]);
      assert.equal(t.db.timeout, 60_000);
    });

    it("normalizes a non-canonical but parseable phone to E.164 at write time", async () => {
      const t = makeDb();
      await sync(t, { mode: "APPEND_ONLY", rows: [row("C001", { phone: "1 (809) 123-4567" })] });
      assert.equal(t.db.created[0]!.phone, "+18091234567");
    });

    it("throws ValidationError and writes nothing when any row has an unparseable phone", async () => {
      const t = makeDb();
      await assert.rejects(
        sync(t, {
          mode: "APPEND_ONLY",
          rows: [row("C001"), row("C002", { phone: "not-a-phone-number" })]
        }),
        ValidationError
      );
      assert.equal(t.db.accounts.length, 0);
      assert.equal(t.db.portfolioUpdate, null);
    });

    it("creates an account with 0 when a new row omits termsAmount and missedInstallments", async () => {
      const t = makeDb();
      const rest: Row = row("C001");
      delete rest.missedInstallments;
      delete rest.termsAmount;
      await sync(t, { mode: "APPEND_ONLY", rows: [rest] });
      assert.equal(t.db.created[0]!.missedInstallments, 0);
      assert.equal(t.db.created[0]!.termsAmount, 0);
    });

    it("sets lastSyncedAt on every account written from rows", async () => {
      const t = makeDb({ accounts: [account("A")] });
      await sync(t, { mode: "UPDATE_EXISTING", rows: [row("A"), row("B")] });
      for (const acc of t.db.accounts) {
        assert.ok(Date.now() - (acc.lastSyncedAt as Date).getTime() < 5_000);
      }
    });
  });

  describe("partial recoveries", () => {
    for (const mode of ["UPDATE_EXISTING", "REPLACE"] as const) {
      it(`records PARTIAL when missedInstallments drops in ${mode}`, async () => {
        const t = makeDb({ accounts: [account("A", { missedInstallments: 3, termsAmount: 100 })] });
        const result = await sync(t, { mode, rows: [row("A", { missedInstallments: 1 })] });
        assert.equal(t.db.recoveries.length, 1);
        assert.equal(t.db.recoveries[0]!.kind, "PARTIAL");
        assert.equal(t.db.recoveries[0]!.installments, 2);
        assert.equal(t.db.recoveries[0]!.amount, 200);
        assert.equal(t.db.recoveries[0]!.exitId, null);
        assert.equal(result.recoveries.partial, 1);
        assert.equal(result.recoveries.amount, 200);
      });
    }

    it("records nothing on an increase, then measures the next drop from the higher value", async () => {
      const t = makeDb({ accounts: [account("A", { missedInstallments: 1 })] });
      await sync(t, { mode: "UPDATE_EXISTING", rows: [row("A", { missedInstallments: 3 })] });
      assert.equal(t.db.recoveries.length, 0);
      await sync(t, { mode: "UPDATE_EXISTING", rows: [row("A", { missedInstallments: 2 })] });
      assert.equal(t.db.recoveries.length, 1);
      assert.equal(t.db.recoveries[0]!.installments, 1);
    });

    it("uses the stored termsAmount and stores the new one for next time", async () => {
      const t = makeDb({ accounts: [account("A", { missedInstallments: 3, termsAmount: 100 })] });
      await sync(t, {
        mode: "UPDATE_EXISTING",
        rows: [row("A", { missedInstallments: 1, termsAmount: 150 })]
      });
      assert.equal(t.db.recoveries[0]!.amount, 200);
      assert.equal(t.db.accounts[0]!.missedInstallments, 1);
      assert.equal(t.db.accounts[0]!.termsAmount, 150);
    });

    it("records the full count when a row drops to 0", async () => {
      const t = makeDb({ accounts: [account("A", { missedInstallments: 3 })] });
      await sync(t, { mode: "UPDATE_EXISTING", rows: [row("A", { missedInstallments: 0 })] });
      assert.equal(t.db.recoveries[0]!.installments, 3);
    });

    it("keeps the stored values and records nothing when a row omits missedInstallments", async () => {
      const t = makeDb({ accounts: [account("A", { missedInstallments: 3, termsAmount: 100 })] });
      const rest: Row = row("A");
      delete rest.missedInstallments;
      delete rest.termsAmount;
      await sync(t, { mode: "UPDATE_EXISTING", rows: [rest] });
      assert.equal(t.db.recoveries.length, 0);
      assert.equal(t.db.accounts[0]!.missedInstallments, 3);
      assert.equal(t.db.accounts[0]!.termsAmount, 100);
    });

    it("never compares in APPEND_ONLY", async () => {
      const t = makeDb({ accounts: [account("A", { missedInstallments: 3 })] });
      await sync(t, { mode: "APPEND_ONLY", rows: [row("A", { missedInstallments: 1 })] });
      assert.equal(t.db.recoveries.length, 0);
    });

    it("uses the backfilled lastSyncedAt on the first sync after deploy", async () => {
      const backfilled = new Date(Date.now() - 14 * DAY);
      const t = makeDb({
        accounts: [account("A", { missedInstallments: 3, lastSyncedAt: backfilled })]
      });
      await sync(t, { mode: "UPDATE_EXISTING", rows: [row("A", { missedInstallments: 1 })] });
      assert.equal((t.db.recoveries[0]!.previousSyncAt as Date).getTime(), backfilled.getTime());
    });

    it("starts a new episode, with no PARTIAL, when an exited account comes back", async () => {
      const exitedAt = new Date(Date.now() - 10 * DAY);
      const t = makeDb({
        accounts: [account("A", { missedInstallments: 3, archivedAt: exitedAt })],
        exits: [
          { id: "ex-1", portfolioAccountId: "acc-A", reason: "CURED", exitedAt, reenteredAt: null }
        ]
      });
      await sync(t, { mode: "UPDATE_EXISTING", rows: [row("A", { missedInstallments: 1 })] });
      assert.equal(t.db.recoveries.length, 0);
      assert.equal(t.db.accounts[0]!.archivedAt, null);
      assert.ok(t.db.exits[0]!.reenteredAt instanceof Date);
    });
  });

  describe("exits", () => {
    it("records a CURED recovery from the exit's own values and marks PENDING promises MET", async () => {
      const t = makeDb({
        accounts: [account("A", { missedInstallments: 3, termsAmount: 100 }), account("B")],
        promises: [promise("A"), promise("B")]
      });
      const result = await sync(t, {
        mode: "UPDATE_EXISTING",
        rows: [],
        exits: [{ externalId: "A", reason: "CURED", missedInstallments: 4, termsAmount: 150 }]
      });
      const rec = t.db.recoveries[0]!;
      assert.equal(rec.kind, "CURED");
      assert.equal(rec.installments, 4);
      assert.equal(rec.amount, 600);
      assert.equal(rec.exitId, t.db.exits[0]!.id);
      assert.equal(t.db.exits[0]!.missedInstallments, 4);
      assert.equal(t.db.promises[0]!.status, "MET");
      assert.equal(t.db.promises[1]!.status, "PENDING");
      assert.ok(t.db.accounts[0]!.archivedAt instanceof Date);
      assert.equal(result.archived, 1);
      assert.equal(result.exitsByReason.CURED, 1);
      assert.deepEqual(result.recoveries, { partial: 0, cured: 1, paidOff: 0, amount: 600 });
    });

    it("records PAID_OFF the same way", async () => {
      const t = makeDb({ accounts: [account("A")] });
      await sync(t, {
        mode: "UPDATE_EXISTING",
        rows: [],
        exits: [{ externalId: "A", reason: "PAID_OFF", missedInstallments: 4, termsAmount: 150 }]
      });
      assert.equal(t.db.recoveries[0]!.kind, "PAID_OFF");
      assert.equal(t.db.recoveries[0]!.amount, 600);
    });

    it("counts a partial and a later cure separately, with no double counting", async () => {
      const t = makeDb({ accounts: [account("A", { missedInstallments: 3, termsAmount: 100 })] });
      await sync(t, { mode: "UPDATE_EXISTING", rows: [row("A", { missedInstallments: 1 })] });
      await sync(t, {
        mode: "UPDATE_EXISTING",
        rows: [],
        exits: [{ externalId: "A", reason: "CURED", missedInstallments: 1, termsAmount: 100 }]
      });
      assert.deepEqual(
        t.db.recoveries.map((r) => [r.kind, r.installments, r.amount]),
        [
          ["PARTIAL", 2, 200],
          ["CURED", 1, 100]
        ]
      );
    });

    for (const reason of ["WRITTEN_OFF", "OTHER"] as const) {
      it(`archives a ${reason} exit, records no recovery and expires promises with the exit id`, async () => {
        const t = makeDb({ accounts: [account("A")], promises: [promise("A")] });
        const result = await sync(t, {
          mode: "UPDATE_EXISTING",
          rows: [],
          exits: [{ externalId: "A", reason }]
        });
        assert.equal(t.db.recoveries.length, 0);
        assert.equal(t.db.exits[0]!.reason, reason);
        assert.equal(t.db.exits[0]!.missedInstallments, 3);
        assert.equal(t.db.promises[0]!.status, "EXPIRED");
        assert.equal(t.db.promises[0]!.expiredByExitId, t.db.exits[0]!.id);
        assert.equal(result.exitsByReason[reason], 1);
      });
    }

    it("leaves UNKNOWN exits for accounts missing from a REPLACE and expires their promises", async () => {
      const t = makeDb({ accounts: [account("A"), account("B")], promises: [promise("B")] });
      const result = await sync(t, {
        mode: "REPLACE",
        rows: [row("A", { missedInstallments: 3 })]
      });
      assert.equal(t.db.exits.length, 1);
      assert.equal(t.db.exits[0]!.reason, "UNKNOWN");
      assert.equal(t.db.exits[0]!.portfolioAccountId, "acc-B");
      assert.equal(t.db.recoveries.length, 0);
      assert.equal(t.db.promises[0]!.status, "EXPIRED");
      assert.equal(t.db.promises[0]!.expiredByExitId, t.db.exits[0]!.id);
      assert.equal(result.exitsByReason.UNKNOWN, 1);
      assert.equal(result.archived, 1);
    });

    for (const mode of ["APPEND_ONLY", "UPDATE_EXISTING"] as const) {
      it(`creates no UNKNOWN exit in ${mode}, but applies listed exits`, async () => {
        const t = makeDb({
          accounts: [account("A"), account("B"), account("C")],
          promises: [promise("B")]
        });
        await sync(t, {
          mode,
          rows: [row("A")],
          exits: [{ externalId: "C", reason: "CURED", missedInstallments: 1, termsAmount: 100 }]
        });
        assert.deepEqual(
          t.db.exits.map((e) => [e.portfolioAccountId, e.reason]),
          [["acc-C", "CURED"]]
        );
        assert.equal(t.db.accounts[1]!.archivedAt, null);
        assert.equal(t.db.promises[0]!.status, "PENDING");
      });
    }

    it("does not touch accounts archived before this sync", async () => {
      const archivedAt = new Date(Date.now() - 60 * DAY);
      const t = makeDb({ accounts: [account("A"), account("B", { archivedAt })] });
      const result = await sync(t, { mode: "REPLACE", rows: [row("A")] });
      assert.equal(t.db.exits.length, 0);
      assert.equal(result.archived, 0);
      assert.equal((t.db.accounts[1]!.archivedAt as Date).getTime(), archivedAt.getTime());
    });

    it("skips an exit for an account archived before recovery tracking existed", async () => {
      const t = makeDb({
        accounts: [account("B", { archivedAt: new Date(Date.now() - 60 * DAY) })]
      });
      const result = await sync(t, {
        mode: "UPDATE_EXISTING",
        rows: [],
        exits: [{ externalId: "B", reason: "CURED", missedInstallments: 2, termsAmount: 100 }]
      });
      assert.equal(t.db.exits.length, 0);
      assert.equal(t.db.recoveries.length, 0);
      assert.equal(result.exitsByReason.skipped, 1);
    });

    it("classifies an UNKNOWN exit that a later sync lists, on the exit's date", async () => {
      const exitedAt = new Date(Date.now() - 20 * DAY);
      const context = {
        hasGestion: true,
        touches: 1,
        activeCampaigns: [{ id: "c1", name: "Mora" }],
        lastTouch: {
          contactLogId: "l1",
          agentType: "SMS",
          delivery: "DELIVERED",
          path: null,
          outcome: null,
          contactedAt: new Date(exitedAt.getTime() - 2 * DAY).toISOString()
        },
        daysSinceLastTouch: 2
      };
      const t = makeDb({
        accounts: [account("A", { archivedAt: exitedAt })],
        exits: [
          {
            id: "ex-1",
            portfolioId: "p1",
            portfolioAccountId: "acc-A",
            reason: "UNKNOWN",
            exitedAt,
            previousSyncAt: new Date(exitedAt.getTime() - 7 * DAY),
            missedInstallments: 3,
            termsAmount: 100,
            context,
            classifiedAt: null,
            reenteredAt: null
          }
        ],
        promises: [
          promise("A", { status: "EXPIRED", expiredByExitId: "ex-1" }),
          promise("A", { status: "EXPIRED", expiredByExitId: "ex-older" })
        ]
      });
      const result = await sync(t, {
        mode: "UPDATE_EXISTING",
        rows: [],
        exits: [{ externalId: "A", reason: "CURED", missedInstallments: 2, termsAmount: 100 }]
      });
      const rec = t.db.recoveries[0]!;
      assert.equal((rec.detectedAt as Date).getTime(), exitedAt.getTime());
      assert.equal(rec.amount, 200);
      assert.equal(rec.exitId, "ex-1");
      assert.deepEqual(rec.context, context);
      assert.deepEqual(rec.campaignIds, ["c1"]);
      assert.equal(t.db.exits[0]!.reason, "CURED");
      assert.equal(t.db.exits[0]!.missedInstallments, 2);
      assert.ok(t.db.exits[0]!.classifiedAt instanceof Date);
      assert.equal(t.db.promises[0]!.status, "MET");
      assert.equal(t.db.promises[1]!.status, "EXPIRED");
      assert.equal(result.exitsByReason.classified, 1);
      assert.equal(result.exitsByReason.CURED, 0);
      assert.equal(result.recoveries.cured, 1);
    });

    it("is a no-op, counted as skipped, when the same exit is sent again", async () => {
      const t = makeDb({ accounts: [account("A")] });
      const input = {
        mode: "UPDATE_EXISTING",
        rows: [],
        exits: [{ externalId: "A", reason: "CURED", missedInstallments: 2, termsAmount: 100 }]
      };
      await sync(t, input);
      const second = await sync(t, input);
      assert.equal(t.db.exits.length, 1);
      assert.equal(t.db.recoveries.length, 1);
      assert.equal(second.exitsByReason.skipped, 1);
    });

    it("rejects exits for externalIds that aren't in the portfolio, writing nothing", async () => {
      const t = makeDb({ accounts: [account("A")] });
      await assert.rejects(
        sync(t, {
          mode: "UPDATE_EXISTING",
          rows: [row("A", { missedInstallments: 1 })],
          exits: [
            { externalId: "C-1042", reason: "OTHER" },
            { externalId: "C-2200", reason: "OTHER" }
          ]
        }),
        (err: Error) => {
          assert.ok(err instanceof ValidationError);
          assert.match(err.message, /externalId\(s\) not in this portfolio: C-1042, C-2200/);
          return true;
        }
      );
      assert.equal(t.db.recoveries.length, 0);
      assert.equal(t.db.accounts[0]!.missedInstallments, 3);
    });

    it("rejects an externalId in both rows and exits", async () => {
      const t = makeDb({ accounts: [account("A")] });
      await assert.rejects(
        sync(t, {
          mode: "UPDATE_EXISTING",
          rows: [row("A")],
          exits: [{ externalId: "A", reason: "OTHER" }]
        }),
        ValidationError
      );
      assert.equal(t.db.portfolioUpdate, null);
    });
  });

  describe("snapshot", () => {
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY);
    const log = (id: string, daysAgo: number, campaignId: string | null, agentType = "SMS") => ({
      id,
      portfolioAccountId: "acc-A",
      campaignId,
      campaign: campaignId ? { name: `Campaign ${campaignId}` } : null,
      agentType,
      delivery: "DELIVERED",
      path: null,
      outcome: "PAYMENT_PROMISE",
      contactedAt: at(daysAgo)
    });

    it("counts only the gestiones between the previous sync and this one", async () => {
      const lastSyncedAt = at(7);
      const t = makeDb({
        accounts: [account("A", { missedInstallments: 3, lastSyncedAt })],
        logs: [
          log("before", 9, "c1"),
          log("in-1", 5, "c1"),
          log("in-2", 2, "c2", "VOICE_AI"),
          log("in-3", 3, "c1"),
          log("no-campaign", 4, null)
        ]
      });
      await sync(t, { mode: "UPDATE_EXISTING", rows: [row("A", { missedInstallments: 2 })] });
      const rec = t.db.recoveries[0]!;
      const ctx = rec.context as Record<string, unknown>;
      assert.equal(ctx.touches, 4);
      assert.equal(ctx.hasGestion, true);
      assert.equal((ctx.lastTouch as Record<string, unknown>).contactLogId, "in-2");
      assert.deepEqual(ctx.activeCampaigns, [
        { id: "c1", name: "Campaign c1" },
        { id: "c2", name: "Campaign c2" }
      ]);
      assert.equal(ctx.daysSinceLastTouch, 2);
      assert.equal(rec.hasGestion, true);
      assert.equal(rec.lastTouchAgentType, "VOICE_AI");
      assert.equal(rec.lastTouchOutcome, "PAYMENT_PROMISE");
      assert.equal(rec.daysSinceLastTouch, 2);
      assert.deepEqual(rec.campaignIds, ["c1", "c2"]);
      assert.equal((rec.previousSyncAt as Date).getTime(), lastSyncedAt.getTime());
    });

    it("stores the snapshot on an exit, from the account's previous sync", async () => {
      const lastSyncedAt = at(7);
      const t = makeDb({
        accounts: [account("A", { lastSyncedAt })],
        logs: [log("in-1", 3, "c1")]
      });
      await sync(t, { mode: "REPLACE", rows: [] });
      const ctx = t.db.exits[0]!.context as Record<string, unknown>;
      assert.equal(ctx.touches, 1);
      assert.equal((t.db.exits[0]!.previousSyncAt as Date).getTime(), lastSyncedAt.getTime());
    });

    it("records no gestión when there were none", async () => {
      const t = makeDb({ accounts: [account("A", { missedInstallments: 3 })] });
      await sync(t, { mode: "UPDATE_EXISTING", rows: [row("A", { missedInstallments: 2 })] });
      const ctx = t.db.recoveries[0]!.context as Record<string, unknown>;
      assert.equal(ctx.hasGestion, false);
      assert.equal(ctx.lastTouch, null);
      assert.equal(ctx.daysSinceLastTouch, null);
      assert.equal(t.db.recoveries[0]!.hasGestion, false);
    });
  });
});
