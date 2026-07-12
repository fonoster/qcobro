import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BillingConfig } from "@qcobro/common";
import { billingConfigSchema } from "@qcobro/common";
import { makeBillingStub } from "./billingStubClient.js";
import { createSubscribeWorkspace } from "./subscribeWorkspace.js";
import { createChangePlan } from "./changePlan.js";
import { handleStripeEvent } from "./handleStripeEvent.js";
import type { StripeGateway, StripeSubscriptionView } from "./stripeGateway.js";

const rates = (sms: number) => ({
  sms: { perMessage: sms },
  email: { perMessage: 0.0004 },
  whatsappMessage: { perMessage: 0.01 },
  voicePrerecorded: { perMinute: 0.28, increments: "15/15" },
  voiceAi: { perMinute: 0.4, increments: "15/15" },
  whatsappVoicePrerecorded: { perMinute: 0.08, increments: "15/15" },
  whatsappVoiceAi: { perMinute: 0.8, increments: "15/15" }
});

const billing = billingConfigSchema.parse({
  enabled: true,
  stripe: { secretKey: "sk_test", webhookSigningSecret: "whsec_test" },
  plans: [
    {
      key: "starter",
      name: { es: "Inicial" },
      monthlyPrice: 9,
      monthlyAllowance: 9,
      stripePriceId: "price_starter",
      rates: rates(0.01)
    },
    {
      key: "growth",
      name: { es: "Crecimiento" },
      monthlyPrice: 29,
      monthlyAllowance: 29,
      stripePriceId: "price_growth",
      rates: rates(0.008)
    }
  ]
}) as NonNullable<BillingConfig>;

// A 30-day cycle with "now" exactly halfway through → prorated grants are 50%.
const PERIOD_START = new Date(Date.now() - 15 * 86_400_000);
const PERIOD_END = new Date(Date.now() + 15 * 86_400_000);

function makeGateway(view?: Partial<StripeSubscriptionView>) {
  const calls: Record<string, unknown[]> = {
    checkout: [],
    addItem: [],
    swap: [],
    schedule: []
  };
  const subscription: StripeSubscriptionView = {
    id: "sub_1",
    customerId: "cus_1",
    currentPeriodStart: PERIOD_START,
    currentPeriodEnd: PERIOD_END,
    items: [{ id: "si_1", priceId: "price_starter", workspaceRef: "ws_1" }],
    ...view
  };
  const gateway: StripeGateway = {
    createCheckoutSession: async (input) => {
      calls.checkout.push(input);
      return { id: "cs_1", url: "https://checkout.stripe.test/cs_1" };
    },
    createPortalSession: async () => ({ url: "https://portal.stripe.test" }),
    getSubscription: async () => subscription,
    addItem: async (input) => {
      calls.addItem.push(input);
      return { id: "si_new" };
    },
    swapItemPrice: async (input) => {
      calls.swap.push(input);
    },
    scheduleItemSwapAtPeriodEnd: async (input) => {
      calls.schedule.push(input);
    },
    getPriceUnitAmount: async () => null
  };
  return { gateway, calls, subscription };
}

describe("subscribeWorkspace", () => {
  const input = (workspaceRef: string) => ({
    workspaceRef,
    planKey: "starter",
    ownerUserRef: "user_1",
    successUrl: "https://app.test/ok",
    cancelUrl: "https://app.test/cancel"
  });

  it("sends a first-time payer to Stripe-hosted Checkout (no local writes)", async () => {
    const stub = makeBillingStub();
    const { gateway, calls } = makeGateway();
    const subscribe = createSubscribeWorkspace(stub.client, gateway, billing);
    const result = await subscribe(input("ws_1"));
    assert.deepEqual(result, { kind: "checkout", url: "https://checkout.stripe.test/cs_1" });
    assert.equal(calls.checkout.length, 1);
    assert.equal(stub.billingAccounts.length, 0); // lazily created by the webhook
    assert.equal(stub.ledgerEntries.length, 0);
  });

  it("adds a prorated item + grant for a payer with an existing subscription", async () => {
    const stub = makeBillingStub({
      billingAccounts: [{ stripeSubscriptionId: "sub_1" }]
    });
    const { gateway, calls } = makeGateway();
    const subscribe = createSubscribeWorkspace(stub.client, gateway, billing);
    const result = await subscribe(input("ws_2"));
    assert.deepEqual(result, { kind: "subscribed" });
    assert.equal(calls.checkout.length, 0);
    assert.equal(calls.addItem.length, 1);
    const enrollment = stub.workspaceBillings.find((w) => w.workspaceRef === "ws_2");
    assert.equal(enrollment?.planKey, "starter");
    // Halfway through the cycle → half of 9.00 = 4.50, within rounding of the clock.
    const grant = stub.ledgerEntries.find((e) => e.kind === "GRANT")!;
    const granted = Number(grant.amountMicro);
    assert.ok(Math.abs(granted - 4_500_000) < 10_000, `granted ${granted}`);
  });

  it("rejects a workspace already on a plan", async () => {
    const stub = makeBillingStub({ workspaceBillings: [{}], billingAccounts: [{}] });
    const { gateway } = makeGateway();
    const subscribe = createSubscribeWorkspace(stub.client, gateway, billing);
    await assert.rejects(
      () => subscribe(input("ws_1")),
      (err: Error) => err.name === "ValidationError"
    );
  });
});

describe("changePlan", () => {
  function enrolledStub(balanceMicro: number) {
    const stub = makeBillingStub({
      workspaceBillings: [{ planKey: "starter", stripeSubscriptionItemId: "si_1" }],
      billingAccounts: [{ stripeSubscriptionId: "sub_1" }]
    });
    void stub.client.ledgerEntry.create({
      data: {
        workspaceRef: "ws_1",
        kind: "GRANT",
        amountMicro: BigInt(balanceMicro),
        at: new Date()
      }
    });
    return stub;
  }

  it("upgrade swaps the price now, voids the remainder, grants prorated allowance", async () => {
    const stub = enrolledStub(2_000_000); // 2.00 left on starter
    const { gateway, calls } = makeGateway();
    const change = createChangePlan(stub.client, gateway, billing);
    const result = await change({ workspaceRef: "ws_1", targetPlanKey: "growth" });
    assert.equal(result.kind, "upgraded");
    assert.deepEqual(calls.swap, [{ itemId: "si_1", priceId: "price_growth" }]);
    assert.equal(stub.workspaceBillings[0].planKey, "growth");
    // Balance = old 2.00 voided + ~half of 29.00 granted.
    const balance = stub.ledgerEntries.reduce((sum, e) => sum + Number(e.amountMicro), 0);
    assert.ok(Math.abs(balance - 14_500_000) < 10_000, `balance ${balance}`);
  });

  it("downgrade only schedules the swap; balance and plan stay until period end", async () => {
    const stub = makeBillingStub({
      workspaceBillings: [{ planKey: "growth", stripeSubscriptionItemId: "si_1" }],
      billingAccounts: [{ stripeSubscriptionId: "sub_1" }]
    });
    void stub.client.ledgerEntry.create({
      data: { workspaceRef: "ws_1", kind: "GRANT", amountMicro: 10_000_000n, at: new Date() }
    });
    const { gateway, calls } = makeGateway();
    const change = createChangePlan(stub.client, gateway, billing);
    const result = await change({ workspaceRef: "ws_1", targetPlanKey: "starter" });
    assert.equal(result.kind, "downgrade_scheduled");
    assert.equal(calls.schedule.length, 1);
    assert.equal(stub.workspaceBillings[0].planKey, "growth"); // unchanged today
    const balance = stub.ledgerEntries.reduce((sum, e) => sum + Number(e.amountMicro), 0);
    assert.equal(balance, 10_000_000);
  });

  it("rejects a change to the current plan", async () => {
    const stub = enrolledStub(0);
    const { gateway } = makeGateway();
    const change = createChangePlan(stub.client, gateway, billing);
    await assert.rejects(
      () => change({ workspaceRef: "ws_1", targetPlanKey: "starter" }),
      (err: Error) => err.name === "ValidationError"
    );
  });
});

describe("handleStripeEvent", () => {
  it("checkout.session.completed provisions payer, enrollment, and initial grant — idempotently", async () => {
    const stub = makeBillingStub();
    const { gateway } = makeGateway();
    const event = {
      type: "checkout.session.completed" as const,
      checkoutSessionId: "cs_1",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      workspaceRef: "ws_1",
      ownerUserRef: "user_1",
      planKey: "starter"
    };
    await handleStripeEvent(stub.client, gateway, billing, event);
    await handleStripeEvent(stub.client, gateway, billing, event); // replay
    assert.equal(stub.billingAccounts.length, 1);
    assert.equal(stub.billingAccounts[0].stripeSubscriptionId, "sub_1");
    assert.equal(stub.workspaceBillings.length, 1);
    assert.equal(stub.workspaceBillings[0].stripeSubscriptionItemId, "si_1");
    const grants = stub.ledgerEntries.filter((e) => e.kind === "GRANT");
    assert.equal(grants.length, 1);
    assert.equal(grants[0].amountMicro, 9_000_000n);
  });

  it("invoice.paid subscription_cycle voids remainders, grants allowances, clears dunning", async () => {
    const stub = makeBillingStub({
      workspaceBillings: [{ planKey: "starter", stripeSubscriptionItemId: "si_1" }],
      billingAccounts: [{ stripeSubscriptionId: "sub_1", paymentFailed: true }]
    });
    void stub.client.ledgerEntry.create({
      data: { workspaceRef: "ws_1", kind: "GRANT", amountMicro: 3_000_000n, at: new Date() }
    });
    const { gateway } = makeGateway();
    const event = {
      type: "invoice.paid" as const,
      invoiceId: "in_2",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      billingReason: "subscription_cycle"
    };
    await handleStripeEvent(stub.client, gateway, billing, event);
    await handleStripeEvent(stub.client, gateway, billing, event); // replay no-ops
    assert.equal(stub.billingAccounts[0].paymentFailed, false);
    const balance = stub.ledgerEntries.reduce((sum, e) => sum + Number(e.amountMicro), 0);
    assert.equal(balance, 9_000_000); // remainder voided, one fresh allowance
  });

  it("invoice.paid after a scheduled downgrade re-derives the plan from the item price", async () => {
    const stub = makeBillingStub({
      workspaceBillings: [{ planKey: "growth", stripeSubscriptionItemId: "si_1" }],
      billingAccounts: [{ stripeSubscriptionId: "sub_1" }]
    });
    // The schedule landed: the item now carries the starter price.
    const { gateway } = makeGateway({
      items: [{ id: "si_1", priceId: "price_starter", workspaceRef: "ws_1" }]
    });
    await handleStripeEvent(stub.client, gateway, billing, {
      type: "invoice.paid",
      invoiceId: "in_3",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      billingReason: "subscription_cycle"
    });
    assert.equal(stub.workspaceBillings[0].planKey, "starter");
    const grants = stub.ledgerEntries.filter((e) => e.kind === "GRANT");
    assert.equal(Number(grants[0].amountMicro), 9_000_000); // starter allowance
  });

  it("invoice.payment_failed suspends the payer (dunning)", async () => {
    const stub = makeBillingStub({ billingAccounts: [{}] });
    const { gateway } = makeGateway();
    await handleStripeEvent(stub.client, gateway, billing, {
      type: "invoice.payment_failed",
      customerId: "cus_1"
    });
    assert.equal(stub.billingAccounts[0].paymentFailed, true);
  });
});
