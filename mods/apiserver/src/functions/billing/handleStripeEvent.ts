import { toMicroUnits, type BillingClient, type BillingConfig } from "@qcobro/common";
import { cycleTurnoverTx } from "./cycleTurnover.js";
import type { StripeGateway } from "./stripeGateway.js";

/**
 * Stripe webhook effects (billing-accounts spec), decoupled from the SDK: the
 * REST handler verifies the signature and maps the event to these minimal
 * shapes, so every branch is testable with stubs. All effects are idempotent —
 * Stripe redelivers events.
 */

/** checkout.session.completed — the payer's first paid workspace finished Checkout. */
export interface CheckoutCompleted {
  type: "checkout.session.completed";
  checkoutSessionId: string;
  customerId: string;
  subscriptionId: string;
  workspaceRef: string;
  ownerUserRef: string;
  planKey: string;
}

/** invoice.paid — the cycle boundary (turnover) and the dunning-recovery signal. */
export interface InvoicePaid {
  type: "invoice.paid";
  invoiceId: string;
  customerId: string;
  subscriptionId: string | null;
  /** Stripe's billing_reason: only "subscription_cycle" turns cycles over. */
  billingReason: string | null;
}

/** invoice.payment_failed — payer enters dunning; all its workspaces suspend. */
export interface InvoicePaymentFailed {
  type: "invoice.payment_failed";
  customerId: string;
}

export type BillingStripeEvent = CheckoutCompleted | InvoicePaid | InvoicePaymentFailed;

export async function handleStripeEvent(
  db: BillingClient,
  stripe: StripeGateway,
  billing: NonNullable<BillingConfig>,
  event: BillingStripeEvent
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      return provisionCheckout(db, stripe, billing, event);
    case "invoice.paid":
      return applyInvoicePaid(db, stripe, billing, event);
    case "invoice.payment_failed": {
      await db.billingAccount.updateMany({
        where: { stripeCustomerId: event.customerId },
        data: { paymentFailed: true }
      });
      return;
    }
  }
}

/**
 * Lazily creates the BillingAccount (payer) and enrolls the workspace after
 * Checkout. The initial allowance grant is keyed by the checkout session id, so
 * a redelivered event cannot double-grant; the subscription's own first
 * invoice.paid has billing_reason "subscription_create" and does NOT turn over.
 */
async function provisionCheckout(
  db: BillingClient,
  stripe: StripeGateway,
  billing: NonNullable<BillingConfig>,
  event: CheckoutCompleted
): Promise<void> {
  const plan = billing.plans.find((p) => p.key === event.planKey);
  if (!plan) {
    console.error(`[billing] checkout for unknown plan "${event.planKey}" — not provisioning`);
    return;
  }
  const sub = await stripe.getSubscription(event.subscriptionId);
  const item = sub.items.find((i) => i.workspaceRef === event.workspaceRef) ?? sub.items[0];

  let account = await db.billingAccount.findFirst({
    where: { stripeCustomerId: event.customerId }
  });
  account ??= await db.billingAccount.create({
    data: {
      createdFromUserRef: event.ownerUserRef,
      stripeCustomerId: event.customerId,
      stripeSubscriptionId: event.subscriptionId
    }
  });
  if (!account.stripeSubscriptionId) {
    account = await db.billingAccount.update({
      where: { id: account.id },
      data: { stripeSubscriptionId: event.subscriptionId }
    });
  }

  const enrollment = await db.workspaceBilling.findUnique({
    where: { workspaceRef: event.workspaceRef }
  });
  if (!enrollment) {
    await db.workspaceBilling.create({
      data: {
        workspaceRef: event.workspaceRef,
        billingAccountId: account.id,
        planKey: plan.key,
        stripeSubscriptionItemId: item?.id ?? null,
        cycleStart: sub.currentPeriodStart,
        cycleEnd: sub.currentPeriodEnd
      }
    });
  }

  try {
    await db.ledgerEntry.create({
      data: {
        workspaceRef: event.workspaceRef,
        kind: "GRANT",
        amountMicro: BigInt(toMicroUnits(plan.monthlyAllowance)),
        at: new Date(),
        stripeInvoiceId: `checkout_${event.checkoutSessionId}`
      }
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err; // replayed event → grant already exists
  }
}

/**
 * The invoice.paid cycle boundary: for each subscription item, void the closing
 * cycle's remainder and grant the (possibly downgraded) plan's allowance —
 * re-deriving each workspace's plan from its item's price, which is how a
 * scheduled downgrade lands. Any successful payment clears dunning.
 */
async function applyInvoicePaid(
  db: BillingClient,
  stripe: StripeGateway,
  billing: NonNullable<BillingConfig>,
  event: InvoicePaid
): Promise<void> {
  await db.billingAccount.updateMany({
    where: { stripeCustomerId: event.customerId },
    data: { paymentFailed: false }
  });

  if (event.billingReason !== "subscription_cycle" || !event.subscriptionId) return;

  const sub = await stripe.getSubscription(event.subscriptionId);
  for (const item of sub.items) {
    if (!item.workspaceRef) continue;
    const plan = billing.plans.find((p) => p.stripePriceId === item.priceId);
    if (!plan) {
      console.error(
        `[billing] item ${item.id} price ${item.priceId} matches no catalog plan — skipping turnover for ${item.workspaceRef}`
      );
      continue;
    }
    const enrollment = await db.workspaceBilling.findUnique({
      where: { workspaceRef: item.workspaceRef }
    });
    if (!enrollment) continue;
    if (enrollment.planKey !== plan.key) {
      await db.workspaceBilling.update({
        where: { workspaceRef: item.workspaceRef },
        data: { planKey: plan.key }
      });
    }
    await db.$transaction((tx) =>
      cycleTurnoverTx(tx, {
        workspaceRef: item.workspaceRef!,
        stripeInvoiceId: event.invoiceId,
        grantMicro: toMicroUnits(plan.monthlyAllowance),
        cycleStart: sub.currentPeriodStart.toISOString(),
        cycleEnd: sub.currentPeriodEnd.toISOString(),
        at: new Date().toISOString()
      })
    );
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}
