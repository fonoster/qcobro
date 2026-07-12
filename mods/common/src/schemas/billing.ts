import { z } from "zod";
import { billingMeterSchema } from "../billing/rates.js";

/**
 * Input schemas for the billing service functions (usage-ledger capability).
 * The client interfaces they pair with live in `../types/billing.ts`.
 */

/** Meters one billable dispatch (priced at write time from the workspace's plan). */
export const meterDispatchSchema = z.object({
  workspaceRef: z.string().min(1),
  meter: billingMeterSchema,
  /** Dispatch instant, ISO. */
  at: z.string().min(1),
  campaignId: z.string().min(1).optional(),
  portfolioAccountId: z.string().min(1).optional(),
  /** Provider ref of the dispatch — the settlement correlation key for voice. */
  providerRef: z.string().min(1).optional()
});
export type MeterDispatchInput = z.infer<typeof meterDispatchSchema>;

/** Settles a voice usage record to its actual answered duration (idempotent per ref). */
export const settleVoiceUsageSchema = z.object({
  providerRef: z.string().min(1),
  /** Answered seconds (answer → hang-up; 0 = never answered, ring time excluded). */
  answeredSeconds: z.number().int().nonnegative(),
  /** Settlement instant, ISO. */
  at: z.string().min(1)
});
export type SettleVoiceUsageInput = z.infer<typeof settleVoiceUsageSchema>;

/**
 * Turns a workspace's billing cycle over (close previous, open next): voids the
 * unused remainder and grants the new allowance. Idempotent per
 * `(workspaceRef, stripeInvoiceId)` — a replayed webhook no-ops.
 */
export const cycleTurnoverSchema = z.object({
  workspaceRef: z.string().min(1),
  stripeInvoiceId: z.string().min(1),
  /** The (possibly prorated) allowance to grant, integer micro-units. */
  grantMicro: z.number().int().nonnegative(),
  /** New cycle bounds, ISO. */
  cycleStart: z.string().min(1),
  cycleEnd: z.string().min(1),
  /** Turnover instant, ISO. */
  at: z.string().min(1)
});
export type CycleTurnoverInput = z.infer<typeof cycleTurnoverSchema>;

/** Reads a workspace's billing status (balance, plan, cycle). */
export const getWorkspaceBillingStatusSchema = z.object({
  workspaceRef: z.string().min(1)
});
export type GetWorkspaceBillingStatusInput = z.infer<typeof getWorkspaceBillingStatusSchema>;

/**
 * Puts a workspace on a paid plan. First paid workspace for a payer → a
 * Stripe-hosted Checkout session (collects the card, creates customer +
 * subscription); subsequent workspaces → a prorated subscription item on the
 * existing subscription, no card entry.
 */
export const subscribeWorkspaceSchema = z.object({
  workspaceRef: z.string().min(1),
  planKey: z.string().min(1),
  ownerUserRef: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url()
});
export type SubscribeWorkspaceInput = z.infer<typeof subscribeWorkspaceSchema>;

/**
 * Changes a workspace's plan. Upgrades apply immediately (prorated charge +
 * prorated allowance replacing the remainder); downgrades take effect at
 * period end via a subscription schedule.
 */
export const changePlanSchema = z.object({
  workspaceRef: z.string().min(1),
  targetPlanKey: z.string().min(1)
});
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
