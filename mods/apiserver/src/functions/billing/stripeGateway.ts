/**
 * The minimal Stripe surface the billing functions use, so tests inject stubs
 * with no live Stripe (mirrors the channel-client pattern). The real adapter
 * over the `stripe` SDK lives in `services/stripeGateway.ts`.
 *
 * Topology (billing-accounts spec): one customer per payer, ONE subscription,
 * one subscription item per workspace with `workspaceRef` in item metadata.
 */

export interface StripeSubscriptionView {
  id: string;
  customerId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  items: { id: string; priceId: string; workspaceRef: string | null }[];
}

export interface StripeGateway {
  /** Hosted Checkout for the payer's FIRST paid workspace (collects the card). */
  createCheckoutSession(input: {
    priceId: string;
    workspaceRef: string;
    ownerUserRef: string;
    planKey: string;
    customerEmail?: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; url: string | null }>;

  /** Hosted customer billing portal (invoices + payment-method management). */
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;

  getSubscription(subscriptionId: string): Promise<StripeSubscriptionView>;

  /** Adds a workspace to an existing subscription (Stripe prorates the charge). */
  addItem(input: {
    subscriptionId: string;
    priceId: string;
    workspaceRef: string;
  }): Promise<{ id: string }>;

  /** Upgrade: swaps the item's price now, invoicing the proration immediately. */
  swapItemPrice(input: { itemId: string; priceId: string }): Promise<void>;

  /** Downgrade: schedules the item's price swap for period end (no proration). */
  scheduleItemSwapAtPeriodEnd(input: {
    subscriptionId: string;
    itemId: string;
    priceId: string;
  }): Promise<void>;

  /** Unit amount (cents) of a price — startup drift validation. */
  getPriceUnitAmount(priceId: string): Promise<number | null>;
}
