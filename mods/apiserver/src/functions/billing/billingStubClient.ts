import type {
  BillingAccountRecord,
  BillingClient,
  LedgerEntryRow,
  UsageRecordRow,
  WorkspaceBillingRecord
} from "@qcobro/common";

/**
 * In-memory BillingClient for unit tests: enforces the ledger's idempotency
 * uniques (workspaceRef+stripeInvoiceId+kind, usageRecordId+kind) so replay
 * semantics are asserted for real, with no live database. Test-only.
 */
export interface BillingStub {
  client: BillingClient;
  usageRecords: UsageRecordRow[];
  ledgerEntries: LedgerEntryRow[];
  workspaceBillings: WorkspaceBillingRecord[];
  billingAccounts: BillingAccountRecord[];
}

export function makeBillingStub(seed?: {
  workspaceBillings?: Partial<WorkspaceBillingRecord>[];
  billingAccounts?: Partial<BillingAccountRecord>[];
}): BillingStub {
  let nextId = 1;
  const usageRecords: UsageRecordRow[] = [];
  const ledgerEntries: LedgerEntryRow[] = [];
  const workspaceBillings: WorkspaceBillingRecord[] = (seed?.workspaceBillings ?? []).map((w) => ({
    workspaceRef: "ws_1",
    billingAccountId: "ba_1",
    planKey: "starter",
    rateOverrides: null,
    stripeSubscriptionItemId: null,
    cycleStart: null,
    cycleEnd: null,
    ...w
  }));
  const billingAccounts: BillingAccountRecord[] = (seed?.billingAccounts ?? []).map((a) => ({
    id: "ba_1",
    createdFromUserRef: "user_1",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: null,
    collectionMethod: "charge_automatically",
    paymentFailed: false,
    ...a
  }));

  const client: BillingClient = {
    workspaceBilling: {
      findUnique: async ({ where }) =>
        workspaceBillings.find((w) => w.workspaceRef === where.workspaceRef) ?? null,
      create: async ({ data }) => {
        const row = {
          rateOverrides: null,
          stripeSubscriptionItemId: null,
          cycleStart: null,
          cycleEnd: null,
          ...data
        } as unknown as WorkspaceBillingRecord;
        workspaceBillings.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = workspaceBillings.find((w) => w.workspaceRef === where.workspaceRef)!;
        return Object.assign(row, data);
      }
    },
    billingAccount: {
      findUnique: async ({ where }) => billingAccounts.find((a) => a.id === where.id) ?? null,
      findFirst: async ({ where }) =>
        billingAccounts.find(
          (a) =>
            (where.stripeCustomerId === undefined ||
              a.stripeCustomerId === where.stripeCustomerId) &&
            (where.createdFromUserRef === undefined ||
              a.createdFromUserRef === where.createdFromUserRef)
        ) ?? null,
      create: async ({ data }) => {
        const row = {
          id: `ba_${nextId++}`,
          stripeSubscriptionId: null,
          collectionMethod: "charge_automatically",
          paymentFailed: false,
          ...data
        } as unknown as BillingAccountRecord;
        billingAccounts.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = billingAccounts.find((a) => a.id === where.id)!;
        return Object.assign(row, data);
      },
      updateMany: async ({ where, data }) => {
        const rows = billingAccounts.filter((a) => a.stripeCustomerId === where.stripeCustomerId);
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      }
    },
    usageRecord: {
      create: async ({ data }) => {
        const row = { id: `ur_${nextId++}`, settledAt: null, ...data } as unknown as UsageRecordRow;
        usageRecords.push(row);
        return row;
      },
      findUnique: async ({ where }) =>
        usageRecords.find((r) => r.providerRef === where.providerRef) ?? null,
      update: async ({ where, data }) => {
        const row = usageRecords.find((r) => r.id === where.id)!;
        return Object.assign(row, data);
      }
    },
    ledgerEntry: {
      create: async ({ data }) => {
        const entry = data as unknown as LedgerEntryRow;
        const duplicate =
          (entry.stripeInvoiceId &&
            ledgerEntries.some(
              (e) =>
                e.workspaceRef === entry.workspaceRef &&
                e.stripeInvoiceId === entry.stripeInvoiceId &&
                e.kind === entry.kind
            )) ||
          (entry.usageRecordId &&
            ledgerEntries.some(
              (e) => e.usageRecordId === entry.usageRecordId && e.kind === entry.kind
            ));
        if (duplicate) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        const row = {
          ...entry,
          id: `le_${nextId++}`,
          usageRecordId: entry.usageRecordId ?? null,
          stripeInvoiceId: entry.stripeInvoiceId ?? null
        };
        ledgerEntries.push(row);
        return row;
      },
      aggregate: async ({ where }) => ({
        _sum: {
          amountMicro: ledgerEntries
            .filter((e) => e.workspaceRef === where.workspaceRef)
            .reduce((sum, e) => sum + BigInt(e.amountMicro), 0n)
        }
      })
    },
    $transaction: async (fn) => fn(client)
  };

  return { client, usageRecords, ledgerEntries, workspaceBillings, billingAccounts };
}
