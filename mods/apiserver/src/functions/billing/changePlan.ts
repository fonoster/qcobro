import {
  changePlanSchema,
  proratedGrantMicro,
  toMicroUnits,
  withErrorHandlingAndValidation,
  type BillingClient,
  type BillingConfig,
  type ChangePlanInput
} from "@qcobro/common";
import { businessError } from "../businessError.js";
import { planFromCatalog } from "./meters.js";
import { workspaceBalanceMicroTx } from "./workspaceBalance.js";
import type { StripeGateway } from "./stripeGateway.js";

export type ChangePlanResult =
  | { kind: "upgraded"; grantedMicro: number }
  | { kind: "downgrade_scheduled"; effectiveAt: string };

/**
 * Changes a workspace's plan (billing-accounts spec). Plan order in the config
 * catalog is the upgrade path: a higher index is an upgrade — the subscription
 * item's price swaps immediately with a prorated charge, the remaining prior
 * allowance is voided, and the new plan's prorated allowance is granted (this
 * is what un-pauses an exhausted workspace). A lower index is a downgrade —
 * scheduled at period end; the current allowance and rates run until then, and
 * the invoice.paid turnover re-derives the plan from the item's new price.
 */
export function createChangePlan(
  db: BillingClient,
  stripe: StripeGateway,
  billing: NonNullable<BillingConfig>
) {
  const fn = async (input: ChangePlanInput): Promise<ChangePlanResult> => {
    const enrollment = await db.workspaceBilling.findUnique({
      where: { workspaceRef: input.workspaceRef }
    });
    if (!enrollment) throw businessError("workspaceRef", "Workspace is not on a plan");
    if (!enrollment.stripeSubscriptionItemId) {
      throw businessError("workspaceRef", "Workspace has no Stripe subscription item");
    }
    const account = await db.billingAccount.findUnique({
      where: { id: enrollment.billingAccountId }
    });
    if (!account?.stripeSubscriptionId) {
      throw businessError("workspaceRef", "Billing account has no subscription");
    }

    const target = planFromCatalog(billing, input.targetPlanKey);
    const currentIndex = billing.plans.findIndex((p) => p.key === enrollment.planKey);
    const targetIndex = billing.plans.findIndex((p) => p.key === target.key);
    if (targetIndex === currentIndex) {
      throw businessError("targetPlanKey", "Workspace is already on this plan");
    }

    const sub = await stripe.getSubscription(account.stripeSubscriptionId);

    if (targetIndex > currentIndex) {
      // Upgrade: swap now (prorated charge), replace the remaining allowance.
      await stripe.swapItemPrice({
        itemId: enrollment.stripeSubscriptionItemId,
        priceId: target.stripePriceId
      });
      const now = new Date();
      const grantMicro = proratedGrantMicro(
        toMicroUnits(target.monthlyAllowance),
        now,
        sub.currentPeriodStart,
        sub.currentPeriodEnd
      );
      await db.$transaction(async (tx) => {
        const remainder = await workspaceBalanceMicroTx(tx, input.workspaceRef);
        if (remainder > 0) {
          await tx.ledgerEntry.create({
            data: {
              workspaceRef: input.workspaceRef,
              kind: "VOID",
              amountMicro: BigInt(-remainder),
              at: now
            }
          });
        }
        await tx.ledgerEntry.create({
          data: {
            workspaceRef: input.workspaceRef,
            kind: "GRANT",
            amountMicro: BigInt(grantMicro),
            at: now
          }
        });
        await tx.workspaceBilling.update({
          where: { workspaceRef: input.workspaceRef },
          data: { planKey: target.key }
        });
      });
      return { kind: "upgraded", grantedMicro: grantMicro };
    }

    // Downgrade: takes effect at period end; nothing changes today.
    await stripe.scheduleItemSwapAtPeriodEnd({
      subscriptionId: account.stripeSubscriptionId,
      itemId: enrollment.stripeSubscriptionItemId,
      priceId: target.stripePriceId
    });
    return { kind: "downgrade_scheduled", effectiveAt: sub.currentPeriodEnd.toISOString() };
  };

  return withErrorHandlingAndValidation(fn, changePlanSchema);
}
