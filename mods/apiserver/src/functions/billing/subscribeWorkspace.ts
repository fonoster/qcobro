import {
  proratedGrantMicro,
  subscribeWorkspaceSchema,
  toMicroUnits,
  withErrorHandlingAndValidation,
  type BillingClient,
  type BillingConfig,
  type SubscribeWorkspaceInput
} from "@qcobro/common";
import { businessError } from "../businessError.js";
import { planFromCatalog } from "./meters.js";
import type { StripeGateway } from "./stripeGateway.js";

export type SubscribeWorkspaceResult =
  /** New payer: finish on Stripe-hosted Checkout (card collection). */
  | { kind: "checkout"; url: string }
  /** Existing payer: item added with proration, allowance granted, done. */
  | { kind: "subscribed" };

/**
 * Puts a workspace on a paid plan (billing-accounts spec). The payer's FIRST
 * paid workspace goes through Stripe-hosted Checkout — the BillingAccount is
 * created lazily by the checkout.session.completed webhook. Subsequent
 * workspaces reuse the payer's card: one prorated subscription item
 * (workspaceRef in metadata) plus the matching prorated allowance grant.
 */
export function createSubscribeWorkspace(
  db: BillingClient,
  stripe: StripeGateway,
  billing: NonNullable<BillingConfig>
) {
  const fn = async (input: SubscribeWorkspaceInput): Promise<SubscribeWorkspaceResult> => {
    const plan = planFromCatalog(billing, input.planKey);

    const existing = await db.workspaceBilling.findUnique({
      where: { workspaceRef: input.workspaceRef }
    });
    if (existing) throw businessError("workspaceRef", "Workspace is already on a plan");

    const account = await db.billingAccount.findFirst({
      where: { createdFromUserRef: input.ownerUserRef }
    });

    if (!account?.stripeSubscriptionId) {
      const session = await stripe.createCheckoutSession({
        priceId: plan.stripePriceId,
        workspaceRef: input.workspaceRef,
        ownerUserRef: input.ownerUserRef,
        planKey: plan.key,
        customerEmail: input.ownerEmail,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl
      });
      if (!session.url) throw businessError("", "Stripe returned no checkout URL");
      return { kind: "checkout", url: session.url };
    }

    // Existing payer: add the item (Stripe prorates the charge), then enroll the
    // workspace and grant the prorated allowance in one transaction.
    const item = await stripe.addItem({
      subscriptionId: account.stripeSubscriptionId,
      priceId: plan.stripePriceId,
      workspaceRef: input.workspaceRef
    });
    const sub = await stripe.getSubscription(account.stripeSubscriptionId);
    const now = new Date();
    const grantMicro = proratedGrantMicro(
      toMicroUnits(plan.monthlyAllowance),
      now,
      sub.currentPeriodStart,
      sub.currentPeriodEnd
    );
    await db.$transaction(async (tx) => {
      await tx.workspaceBilling.create({
        data: {
          workspaceRef: input.workspaceRef,
          billingAccountId: account.id,
          planKey: plan.key,
          stripeSubscriptionItemId: item.id,
          cycleStart: sub.currentPeriodStart,
          cycleEnd: sub.currentPeriodEnd
        }
      });
      await tx.ledgerEntry.create({
        data: {
          workspaceRef: input.workspaceRef,
          kind: "GRANT",
          amountMicro: BigInt(grantMicro),
          at: now,
          // Item id as the idempotency key for this mid-cycle grant.
          stripeInvoiceId: `item_${item.id}`
        }
      });
    });
    return { kind: "subscribed" };
  };

  return withErrorHandlingAndValidation(fn, subscribeWorkspaceSchema);
}
