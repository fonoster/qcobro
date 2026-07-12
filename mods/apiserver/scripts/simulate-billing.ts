/**
 * Dev tool: run the billing edge-case scenario suite in memory and judge it.
 *
 *   npm run billing:sim --workspace=mods/apiserver
 *
 * Mirrors `simulate-engine-tick.ts` in spirit, but nothing here needs a
 * database or Stripe: synthetic dispatches flow through the REAL pricing,
 * ledger, gate, plan-change, and webhook functions against the in-memory
 * BillingClient (which enforces the same idempotency uniques as Postgres) and
 * a stub Stripe gateway. Exits non-zero when a scenario assertion or a
 * billing invariant (BIL-1…BIL-6) fails — CI-friendly.
 *
 * Scenarios (billing-evaluation spec): mid-cycle signup proration, hard stop
 * at exhaustion, voice in-flight overshoot bound, upgrade-while-exhausted,
 * downgrade-then-turnover, replayed webhooks.
 */
import {
  billingConfigSchema,
  evaluateBilling,
  ledgerEntrySchema,
  usageRecordSchema,
  voiceOvershootBoundMicro,
  type BillingConfig
} from "@qcobro/common";
import { makeBillingStub, type BillingStub } from "../src/functions/billing/billingStubClient.js";
import { meterDispatchTx } from "../src/functions/billing/meterDispatch.js";
import { settleVoiceUsageTx } from "../src/functions/billing/settleVoiceUsage.js";
import { workspaceBalanceMicroTx } from "../src/functions/billing/workspaceBalance.js";
import { assessManualDispatch } from "../src/functions/billing/manualDispatchGate.js";
import { createChangePlan } from "../src/functions/billing/changePlan.js";
import { handleStripeEvent } from "../src/functions/billing/handleStripeEvent.js";
import type {
  StripeGateway,
  StripeSubscriptionView
} from "../src/functions/billing/stripeGateway.js";

const rates = (sms: number, voiceAi: number) => ({
  sms: { perMessage: sms },
  email: { perMessage: 0.0005 },
  whatsappMessage: { perMessage: 0.01 },
  voicePrerecorded: { perMinute: 0.28, increments: "15/15" },
  voiceAi: { perMinute: voiceAi, increments: "15/15" },
  whatsappVoicePrerecorded: { perMinute: 0.08, increments: "15/15" },
  whatsappVoiceAi: { perMinute: 0.8, increments: "15/15" }
});

const billing = billingConfigSchema.parse({
  enabled: true,
  voiceDebitEstimateSeconds: 60,
  plans: [
    {
      key: "starter",
      name: { es: "Inicial" },
      monthlyPrice: 9,
      monthlyAllowance: 9,
      stripePriceId: "price_starter",
      rates: rates(0.01, 0.48)
    },
    {
      key: "growth",
      name: { es: "Crecimiento" },
      monthlyPrice: 29,
      monthlyAllowance: 29,
      stripePriceId: "price_growth",
      rates: rates(0.008, 0.4)
    }
  ]
}) as NonNullable<BillingConfig>;

let failures = 0;
function check(name: string, ok: boolean, details = ""): void {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${ok || !details ? "" : ` — ${details}`}`);
  if (!ok) failures += 1;
}

function makeGateway(items: StripeSubscriptionView["items"]): StripeGateway {
  const view: StripeSubscriptionView = {
    id: "sub_1",
    customerId: "cus_1",
    currentPeriodStart: new Date(Date.now() - 15 * 86_400_000),
    currentPeriodEnd: new Date(Date.now() + 15 * 86_400_000),
    items
  };
  return {
    createCheckoutSession: async () => ({ id: "cs_1", url: "https://stripe.test" }),
    createPortalSession: async () => ({ url: "https://stripe.test" }),
    getSubscription: async () => view,
    addItem: async () => ({ id: "si_new" }),
    swapItemPrice: async ({ itemId, priceId }) => {
      const item = view.items.find((i) => i.id === itemId);
      if (item) item.priceId = priceId;
    },
    scheduleItemSwapAtPeriodEnd: async () => undefined,
    setItemWorkspaceRef: async ({ itemId, workspaceRef }) => {
      const item = view.items.find((i) => i.id === itemId);
      if (item) item.workspaceRef = workspaceRef;
    },
    removeItem: async () => undefined,
    getPriceUnitAmount: async () => null
  };
}

/** Dispatch one metered unit through gate + ledger; false = gate refused. */
async function dispatch(
  stub: BillingStub,
  meter: "sms" | "voiceAi",
  ref: string
): Promise<boolean> {
  const gate = await assessManualDispatch(stub.client, billing, "ws_1", meter);
  if (gate.kind !== "metered" && gate.kind !== "unmetered") return false;
  await stub.client.$transaction((tx) =>
    meterDispatchTx(tx, billing, {
      workspaceRef: "ws_1",
      meter,
      at: new Date().toISOString(),
      providerRef: ref
    })
  );
  return true;
}

function enrolledStub(grantMicro: number): BillingStub {
  const stub = makeBillingStub({
    workspaceBillings: [{ planKey: "starter", stripeSubscriptionItemId: "si_1" }],
    billingAccounts: [{ stripeSubscriptionId: "sub_1" }]
  });
  void stub.client.ledgerEntry.create({
    data: { workspaceRef: "ws_1", kind: "GRANT", amountMicro: BigInt(grantMicro), at: new Date() }
  });
  return stub;
}

async function main(): Promise<void> {
  const all: BillingStub[] = [];

  console.log("S1 — hard stop: 9.00 starter allowance at 0.01/SMS stops at 900 sends");
  {
    const stub = enrolledStub(9_000_000);
    all.push(stub);
    let sent = 0;
    for (let i = 0; i < 1000; i++) {
      if (!(await dispatch(stub, "sms", `sms_${i}`))) break;
      sent += 1;
    }
    check("exactly 900 dispatches before the gate closes", sent === 900, `sent ${sent}`);
    check("balance is exactly zero", (await workspaceBalanceMicroTx(stub.client, "ws_1")) === 0);
    check("gate refuses the 901st", !(await dispatch(stub, "sms", "sms_overflow")));
  }

  console.log("S2 — voice overshoot: in-flight calls settle upward within the bound");
  {
    const stub = enrolledStub(1_000_000); // 1.00 — covers two 60s voiceAi estimates at 0.48/min
    all.push(stub);
    const okA = await dispatch(stub, "voiceAi", "call_a");
    const okB = await dispatch(stub, "voiceAi", "call_b");
    const okC = await dispatch(stub, "voiceAi", "call_c"); // gate must refuse (0.04 left)
    check("two calls in flight, third refused", okA && okB && !okC);
    // Both in-flight calls run 5 minutes (300s) — worst case for the estimate.
    for (const ref of ["call_a", "call_b"]) {
      await stub.client.$transaction((tx) =>
        settleVoiceUsageTx(tx, {
          providerRef: ref,
          answeredSeconds: 300,
          at: new Date().toISOString()
        })
      );
    }
    const balance = await workspaceBalanceMicroTx(stub.client, "ws_1");
    const bound = voiceOvershootBoundMicro(0.48, "15/15", 60, 300, 2);
    check(
      `negative balance ${balance} within the overshoot bound −${bound + 1_000_000}`,
      balance < 0 && -balance <= bound + 1_000_000 // bound + the 1.00 they were allowed to spend
    );
    check("no further dispatch after overshoot", !(await dispatch(stub, "sms", "post_overshoot")));
  }

  console.log("S3 — upgrade while exhausted replenishes prorated credits and resumes");
  {
    const stub = enrolledStub(5_000); // less than one SMS left on starter
    all.push(stub);
    check("gate closed before upgrade", !(await dispatch(stub, "sms", "pre_upgrade")));
    const change = createChangePlan(
      stub.client,
      makeGateway([{ id: "si_1", priceId: "price_starter", workspaceRef: "ws_1" }]),
      billing
    );
    const result = await change({ workspaceRef: "ws_1", targetPlanKey: "growth" });
    const balance = await workspaceBalanceMicroTx(stub.client, "ws_1");
    // Halfway through the cycle → ~half of 29.00.
    check(
      "upgrade granted ~14.50 prorated",
      result.kind === "upgraded" && Math.abs(balance - 14_500_000) < 20_000,
      `balance ${balance}`
    );
    check("dispatch resumes after upgrade", await dispatch(stub, "sms", "post_upgrade"));
  }

  console.log("S4 — downgrade lands at turnover: plan re-derived from the item price");
  {
    const stub = makeBillingStub({
      workspaceBillings: [{ planKey: "growth", stripeSubscriptionItemId: "si_1" }],
      billingAccounts: [{ stripeSubscriptionId: "sub_1" }]
    });
    all.push(stub);
    // The schedule already swapped the item to starter; the cycle invoice pays.
    const gateway = makeGateway([{ id: "si_1", priceId: "price_starter", workspaceRef: "ws_1" }]);
    const invoice = {
      type: "invoice.paid" as const,
      invoiceId: "in_cycle",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      billingReason: "subscription_cycle"
    };
    await handleStripeEvent(stub.client, gateway, billing, invoice);
    await handleStripeEvent(stub.client, gateway, billing, invoice); // replay
    check("plan re-derived to starter", stub.workspaceBillings[0].planKey === "starter");
    check(
      "starter allowance granted once despite replay",
      (await workspaceBalanceMicroTx(stub.client, "ws_1")) === 9_000_000
    );
  }

  console.log("Invariants (BIL-1…BIL-6) over all scenario ledgers");
  {
    const usageRecords = all.flatMap((s) =>
      s.usageRecords.map((r) =>
        usageRecordSchema.parse({
          id: r.id,
          workspaceRef: r.workspaceRef,
          meter: r.meter === "SMS" ? "sms" : r.meter === "VOICE_AI" ? "voiceAi" : "email",
          quantity: r.quantity,
          unitPriceMicro: Number(r.unitPriceMicro),
          amountMicro: Number(r.amountMicro),
          providerRef: r.providerRef ?? undefined,
          at: r.at instanceof Date ? r.at.toISOString() : String(r.at)
        })
      )
    );
    const withIncrements = all.flatMap((s) => s.usageRecords);
    const ledgerEntries = all.flatMap((s) =>
      s.ledgerEntries.map((e) =>
        ledgerEntrySchema.parse({
          id: e.id,
          workspaceRef: e.workspaceRef,
          kind: e.kind,
          amountMicro: Number(e.amountMicro),
          at: e.at instanceof Date ? e.at.toISOString() : String(e.at),
          usageRecordId: e.usageRecordId ?? undefined,
          stripeInvoiceId: e.stripeInvoiceId ?? undefined
        })
      )
    );
    const scorecard = evaluateBilling({
      billing,
      usageRecords: usageRecords.map((record, index) => ({
        ...record,
        // carry the frozen increments through for BIL-4
        ...(withIncrements[index]?.increments
          ? { increments: withIncrements[index].increments }
          : {})
      })),
      ledgerEntries
    });
    for (const inv of scorecard.invariants) {
      check(`${inv.id} ${inv.description}`, inv.verdict === "pass", inv.details ?? "");
    }
  }

  console.log(failures === 0 ? "\nAll billing scenarios pass." : `\n${failures} failure(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
