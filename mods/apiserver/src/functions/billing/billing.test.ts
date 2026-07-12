import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  BillingClient,
  BillingConfig,
  LedgerEntryRow,
  UsageRecordRow,
  WorkspaceBillingRecord
} from "@qcobro/common";
import { billingConfigSchema } from "@qcobro/common";
import { meterDispatchTx, createMeterDispatch } from "./meterDispatch.js";
import { settleVoiceUsageTx } from "./settleVoiceUsage.js";
import { cycleTurnoverTx } from "./cycleTurnover.js";
import { workspaceBalanceMicroTx } from "./workspaceBalance.js";

const billing = billingConfigSchema.parse({
  enabled: true,
  voiceDebitEstimateSeconds: 60,
  plans: [
    {
      key: "growth",
      name: { en: "Growth", es: "Crecimiento" },
      monthlyPrice: 29,
      monthlyAllowance: 29,
      stripePriceId: "price_growth",
      rates: {
        sms: { perMessage: 0.008 },
        email: { perMessage: 0.0004 },
        whatsappMessage: { perMessage: 0.01 },
        voicePrerecorded: { perMinute: 0.28, increments: "15/15" },
        voiceAi: { perMinute: 0.4, increments: "15/15" },
        whatsappVoicePrerecorded: { perMinute: 0.08, increments: "15/15" },
        whatsappVoiceAi: { perMinute: 0.8, increments: "15/15" }
      }
    }
  ]
}) as NonNullable<BillingConfig>;

/** In-memory BillingClient stub: real enough to assert ledger math end to end. */
function makeStub(enrollment: Partial<WorkspaceBillingRecord> | null = {}) {
  const usageRecords: UsageRecordRow[] = [];
  const ledgerEntries: LedgerEntryRow[] = [];
  let nextId = 1;
  const workspaceBilling: WorkspaceBillingRecord | null =
    enrollment === null
      ? null
      : {
          workspaceRef: "ws_1",
          billingAccountId: "ba_1",
          planKey: "growth",
          rateOverrides: null,
          stripeSubscriptionItemId: "si_1",
          cycleStart: null,
          cycleEnd: null,
          ...enrollment
        };

  const client: BillingClient = {
    workspaceBilling: {
      findUnique: async ({ where }) =>
        workspaceBilling && where.workspaceRef === workspaceBilling.workspaceRef
          ? workspaceBilling
          : null,
      update: async ({ data }) => Object.assign(workspaceBilling!, data)
    },
    billingAccount: {
      findUnique: async () => ({
        id: "ba_1",
        paymentFailed: false,
        collectionMethod: "charge_automatically"
      })
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
        if (
          entry.stripeInvoiceId &&
          ledgerEntries.some(
            (e) =>
              e.workspaceRef === entry.workspaceRef &&
              e.stripeInvoiceId === entry.stripeInvoiceId &&
              e.kind === entry.kind
          )
        ) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        const row = { id: `le_${nextId++}`, usageRecordId: null, stripeInvoiceId: null, ...entry };
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
  return { client, usageRecords, ledgerEntries };
}

describe("meterDispatchTx", () => {
  it("prices an SMS at write time and debits the ledger in the same call", async () => {
    const { client, usageRecords, ledgerEntries } = makeStub();
    const record = await meterDispatchTx(client, billing, {
      workspaceRef: "ws_1",
      meter: "sms",
      at: "2026-07-11T12:00:00.000Z",
      campaignId: "cmp_1",
      providerRef: "SM1"
    });
    assert.ok(record);
    assert.equal(usageRecords[0].meter, "SMS");
    assert.equal(usageRecords[0].amountMicro, 8000n);
    assert.equal(ledgerEntries[0].kind, "USAGE_DEBIT");
    assert.equal(ledgerEntries[0].amountMicro, -8000n);
    assert.equal(ledgerEntries[0].usageRecordId, record.id);
  });

  it("debits the voice estimate and freezes rate + increments on the row", async () => {
    const { client, usageRecords, ledgerEntries } = makeStub();
    await meterDispatchTx(client, billing, {
      workspaceRef: "ws_1",
      meter: "voiceAi",
      at: "2026-07-11T12:00:00.000Z",
      providerRef: "call-1"
    });
    const row = usageRecords[0];
    assert.equal(row.meter, "VOICE_AI");
    assert.equal(row.quantity, 60); // 60s estimate under 15/15
    assert.equal(row.unitPriceMicro, 400000n);
    assert.equal(row.amountMicro, 400000n); // 60s at 0.40/min
    assert.equal(row.increments, "15/15");
    assert.equal(ledgerEntries[0].amountMicro, -400000n);
  });

  it("applies a workspace rate override to the overridden meter only", async () => {
    const { client, usageRecords } = makeStub({
      rateOverrides: { sms: { perMessage: 0.005 } }
    });
    await meterDispatchTx(client, billing, {
      workspaceRef: "ws_1",
      meter: "sms",
      at: "2026-07-11T12:00:00.000Z"
    });
    assert.equal(usageRecords[0].amountMicro, 5000n);
  });

  it("skips unenrolled workspaces without writing", async () => {
    const { client, usageRecords, ledgerEntries } = makeStub(null);
    const record = await meterDispatchTx(client, billing, {
      workspaceRef: "ws_other",
      meter: "sms",
      at: "2026-07-11T12:00:00.000Z"
    });
    assert.equal(record, null);
    assert.equal(usageRecords.length, 0);
    assert.equal(ledgerEntries.length, 0);
  });

  it("rejects invalid input with a structured error and no side effect", async () => {
    const { client, usageRecords } = makeStub();
    const meter = createMeterDispatch(client, billing);
    await assert.rejects(
      () => meter({ workspaceRef: "", meter: "sms", at: "2026-07-11T12:00:00.000Z" }),
      (err: Error) => err.name === "ValidationError"
    );
    assert.equal(usageRecords.length, 0);
  });
});

describe("settleVoiceUsageTx", () => {
  async function dispatchVoice(stub: ReturnType<typeof makeStub>) {
    await meterDispatchTx(stub.client, billing, {
      workspaceRef: "ws_1",
      meter: "voiceAi",
      at: "2026-07-11T12:00:00.000Z",
      providerRef: "call-1"
    });
  }

  it("settles a longer call upward so net equals the increment-billed amount", async () => {
    const stub = makeStub();
    await dispatchVoice(stub);
    await settleVoiceUsageTx(stub.client, {
      providerRef: "call-1",
      answeredSeconds: 95,
      at: "2026-07-11T12:02:00.000Z"
    });
    // 95s → 105 billed seconds at 0.40/min = 700000 micro.
    assert.equal(stub.usageRecords[0].quantity, 105);
    assert.equal(stub.usageRecords[0].amountMicro, 700000n);
    const net = await workspaceBalanceMicroTx(stub.client, "ws_1");
    assert.equal(net, -700_000);
  });

  it("settles an unanswered call to net zero", async () => {
    const stub = makeStub();
    await dispatchVoice(stub);
    await settleVoiceUsageTx(stub.client, {
      providerRef: "call-1",
      answeredSeconds: 0,
      at: "2026-07-11T12:02:00.000Z"
    });
    assert.equal(await workspaceBalanceMicroTx(stub.client, "ws_1"), 0);
  });

  it("is idempotent per call ref", async () => {
    const stub = makeStub();
    await dispatchVoice(stub);
    const first = await settleVoiceUsageTx(stub.client, {
      providerRef: "call-1",
      answeredSeconds: 95,
      at: "2026-07-11T12:02:00.000Z"
    });
    const second = await settleVoiceUsageTx(stub.client, {
      providerRef: "call-1",
      answeredSeconds: 300,
      at: "2026-07-11T12:03:00.000Z"
    });
    assert.ok(first);
    assert.equal(second, null);
    assert.equal(await workspaceBalanceMicroTx(stub.client, "ws_1"), -700_000);
  });

  it("ignores refs that match no voice usage", async () => {
    const stub = makeStub();
    const result = await settleVoiceUsageTx(stub.client, {
      providerRef: "unknown",
      answeredSeconds: 10,
      at: "2026-07-11T12:02:00.000Z"
    });
    assert.equal(result, null);
  });
});

describe("cycleTurnoverTx", () => {
  const turnover = (client: BillingClient, invoiceId: string) =>
    cycleTurnoverTx(client, {
      workspaceRef: "ws_1",
      stripeInvoiceId: invoiceId,
      grantMicro: 29_000_000,
      cycleStart: "2026-08-01T00:00:00.000Z",
      cycleEnd: "2026-09-01T00:00:00.000Z",
      at: "2026-08-01T00:00:00.000Z"
    });

  it("voids the unused remainder and grants the new allowance", async () => {
    const stub = makeStub();
    await stub.client.ledgerEntry.create({
      data: { workspaceRef: "ws_1", kind: "GRANT", amountMicro: 29_000_000n, at: new Date() }
    });
    await stub.client.ledgerEntry.create({
      data: { workspaceRef: "ws_1", kind: "USAGE_DEBIT", amountMicro: -24_800_000n, at: new Date() }
    });
    const result = await turnover(stub.client, "in_1");
    assert.equal(result.applied, true);
    assert.equal(result.voidedMicro, 4_200_000);
    assert.equal(await workspaceBalanceMicroTx(stub.client, "ws_1"), 29_000_000);
  });

  it("no-ops on a replayed invoice", async () => {
    const stub = makeStub();
    const first = await turnover(stub.client, "in_1");
    const replay = await turnover(stub.client, "in_1");
    assert.equal(first.applied, true);
    assert.equal(replay.applied, false);
    assert.equal(await workspaceBalanceMicroTx(stub.client, "ws_1"), 29_000_000);
    assert.equal(stub.ledgerEntries.filter((e) => e.kind === "GRANT").length, 1);
  });

  it("does not void when the closing balance is already negative (voice overshoot)", async () => {
    const stub = makeStub();
    await stub.client.ledgerEntry.create({
      data: { workspaceRef: "ws_1", kind: "USAGE_DEBIT", amountMicro: -150_000n, at: new Date() }
    });
    const result = await turnover(stub.client, "in_1");
    assert.equal(result.voidedMicro, 0);
    // Overshoot carries into the new cycle: 29.00 − 0.15.
    assert.equal(await workspaceBalanceMicroTx(stub.client, "ws_1"), 28_850_000);
  });
});
