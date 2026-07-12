import Stripe from "stripe";
import type { BillingConfig } from "@qcobro/common";
import type { StripeGateway, StripeSubscriptionView } from "../functions/billing/stripeGateway.js";

/** Real Stripe adapter; null when billing or its Stripe credentials are absent. */
export function createStripeGateway(billing: BillingConfig): StripeGateway | null {
  if (!billing?.enabled || !billing.stripe) return null;
  const stripe = new Stripe(billing.stripe.secretKey);

  function toView(sub: Stripe.Subscription): StripeSubscriptionView {
    const first = sub.items.data[0];
    return {
      id: sub.id,
      customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      currentPeriodStart: new Date((first?.current_period_start ?? 0) * 1000),
      currentPeriodEnd: new Date((first?.current_period_end ?? 0) * 1000),
      items: sub.items.data.map((item) => ({
        id: item.id,
        priceId: typeof item.price === "string" ? item.price : item.price.id,
        workspaceRef: item.metadata?.workspaceRef ?? null
      }))
    };
  }

  return {
    async createCheckoutSession(input) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: input.priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        subscription_data: {
          metadata: {
            workspaceRef: input.workspaceRef,
            ownerUserRef: input.ownerUserRef,
            planKey: input.planKey
          }
        },
        metadata: {
          workspaceRef: input.workspaceRef,
          ownerUserRef: input.ownerUserRef,
          planKey: input.planKey
        }
      });
      return { id: session.id, url: session.url };
    },

    async createPortalSession(input) {
      const session = await stripe.billingPortal.sessions.create({
        customer: input.customerId,
        return_url: input.returnUrl
      });
      return { url: session.url };
    },

    async getSubscription(subscriptionId) {
      return toView(await stripe.subscriptions.retrieve(subscriptionId));
    },

    async addItem(input) {
      const item = await stripe.subscriptionItems.create({
        subscription: input.subscriptionId,
        price: input.priceId,
        quantity: 1,
        proration_behavior: "always_invoice",
        metadata: { workspaceRef: input.workspaceRef }
      });
      return { id: item.id };
    },

    async setItemWorkspaceRef(input) {
      await stripe.subscriptionItems.update(input.itemId, {
        metadata: { workspaceRef: input.workspaceRef }
      });
    },

    async removeItem(input) {
      await stripe.subscriptionItems.del(input.itemId, { proration_behavior: "always_invoice" });
    },

    async swapItemPrice(input) {
      await stripe.subscriptionItems.update(input.itemId, {
        price: input.priceId,
        proration_behavior: "always_invoice"
      });
    },

    async scheduleItemSwapAtPeriodEnd(input) {
      // Build a two-phase schedule from the live subscription: phase 1 keeps the
      // current items until period end; phase 2 swaps the one item's price.
      const sub = await stripe.subscriptions.retrieve(input.subscriptionId);
      const scheduleId =
        typeof sub.schedule === "string"
          ? sub.schedule
          : (sub.schedule?.id ??
            (await stripe.subscriptionSchedules.create({ from_subscription: input.subscriptionId }))
              .id);
      const currentItems = sub.items.data.map((item) => ({
        price: typeof item.price === "string" ? item.price : item.price.id,
        quantity: item.quantity ?? 1,
        metadata: item.metadata
      }));
      const nextItems = sub.items.data.map((item) => ({
        price:
          item.id === input.itemId
            ? input.priceId
            : typeof item.price === "string"
              ? item.price
              : item.price.id,
        quantity: item.quantity ?? 1,
        metadata: item.metadata
      }));
      const periodStart = sub.items.data[0]?.current_period_start;
      const periodEnd = sub.items.data[0]?.current_period_end;
      if (!periodStart || !periodEnd) {
        throw new Error(`Subscription ${input.subscriptionId} has no current period bounds`);
      }
      // Phase 1 must anchor at the CURRENT period start (not the subscription's
      // original start_date — Stripe rejects phases that don't align with it).
      await stripe.subscriptionSchedules.update(scheduleId, {
        end_behavior: "release",
        phases: [
          { items: currentItems, start_date: periodStart, end_date: periodEnd },
          { items: nextItems, start_date: periodEnd, proration_behavior: "none" }
        ]
      });
    },

    async getPriceUnitAmount(priceId) {
      const price = await stripe.prices.retrieve(priceId);
      return price.unit_amount;
    }
  };
}

/** Raw SDK access for webhook signature verification (rest/stripeWebhook.ts). */
export function createStripeSdk(billing: BillingConfig): Stripe | null {
  if (!billing?.enabled || !billing.stripe) return null;
  return new Stripe(billing.stripe.secretKey);
}

/**
 * Startup drift validation: warn when a catalog plan's Stripe price amount
 * disagrees with its configured monthlyPrice (billing-accounts spec risk).
 */
export async function validateStripePrices(
  gateway: StripeGateway,
  billing: NonNullable<BillingConfig>
): Promise<void> {
  await Promise.all(
    billing.plans.map(async (plan) => {
      try {
        const unitAmount = await gateway.getPriceUnitAmount(plan.stripePriceId);
        const expectedCents = Math.round(plan.monthlyPrice * 100);
        if (unitAmount !== null && unitAmount !== expectedCents) {
          console.warn(
            `[billing] price drift: plan "${plan.key}" configures ${expectedCents} cents but Stripe price ${plan.stripePriceId} charges ${unitAmount}`
          );
        }
      } catch (err) {
        console.warn(
          `[billing] could not verify Stripe price for plan "${plan.key}":`,
          err instanceof Error ? err.message : err
        );
      }
    })
  );
}
