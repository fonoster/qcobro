import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { BillingClient } from "@qcobro/common";
import { microUnitsToDecimalString, toMicroUnits } from "@qcobro/common";
import { ownerProcedure, router, workspaceProcedure } from "../trpc.js";
import { config } from "../../config.js";
import { createSubscribeWorkspace } from "../../functions/billing/subscribeWorkspace.js";
import { createChangePlan } from "../../functions/billing/changePlan.js";
import { workspaceBalanceMicroTx } from "../../functions/billing/workspaceBalance.js";
import { planFromCatalog } from "../../functions/billing/meters.js";
import type { StripeGateway } from "../../functions/billing/stripeGateway.js";

function requireStripe(gateway: StripeGateway | null) {
  if (!config.billing?.enabled || !gateway) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "billing_not_configured" });
  }
  return { billing: config.billing, gateway };
}

/**
 * Billing console surface (billing-console spec). `status` and `plans` are
 * admin-visible (the meter and paused states); everything payment-shaped —
 * subscribe, plan changes, the Stripe portal — is owner-only and completes on
 * Stripe-hosted pages (the console never touches card data or invoices).
 */
export const billingRouter = router({
  /** Credit meter + paused state for the active workspace (admins and owners). */
  status: workspaceProcedure.query(async ({ ctx }) => {
    const workspaceRef = ctx.workspace.accessKeyId;
    if (!config.billing?.enabled) return { enabled: false as const };

    const db = ctx.prisma as unknown as BillingClient;
    const enrollment = await db.workspaceBilling.findUnique({ where: { workspaceRef } });
    if (!enrollment) return { enabled: true as const, enrolled: false as const };

    const account = await db.billingAccount.findUnique({
      where: { id: enrollment.billingAccountId }
    });
    const plan = planFromCatalog(config.billing, enrollment.planKey);
    const balanceMicro = await workspaceBalanceMicroTx(db, workspaceRef);
    const allowanceMicro = toMicroUnits(plan.monthlyAllowance);

    // Burn projection: consumption since cycle start, extrapolated to days left
    // of balance. Omitted until there is usage (billing-console spec).
    let projectedDaysRemaining: number | null = null;
    if (enrollment.cycleStart) {
      const consumed = await ctx.prisma.ledgerEntry.aggregate({
        where: {
          workspaceRef,
          kind: { in: ["USAGE_DEBIT", "ADJUSTMENT"] },
          at: { gte: enrollment.cycleStart }
        },
        _sum: { amountMicro: true }
      });
      const consumedMicro = Math.abs(Number(consumed._sum.amountMicro ?? 0n));
      const elapsedDays = (Date.now() - enrollment.cycleStart.getTime()) / 86_400_000;
      if (consumedMicro > 0 && elapsedDays > 0 && balanceMicro > 0) {
        projectedDaysRemaining = Math.round(balanceMicro / (consumedMicro / elapsedDays));
      }
    }

    const paused = account?.paymentFailed
      ? ("payment_failed" as const)
      : balanceMicro <= 0
        ? ("credits_exhausted" as const)
        : null;

    return {
      enabled: true as const,
      enrolled: true as const,
      planKey: plan.key,
      planName: plan.name,
      balance: microUnitsToDecimalString(Math.max(0, balanceMicro)),
      allowance: microUnitsToDecimalString(allowanceMicro),
      balanceMicro,
      allowanceMicro,
      cycleStart: enrollment.cycleStart?.toISOString() ?? null,
      cycleEnd: enrollment.cycleEnd?.toISOString() ?? null,
      projectedDaysRemaining,
      paused
    };
  }),

  /** The plan catalog in upgrade-path order, with the workspace's current key. */
  plans: workspaceProcedure.query(async ({ ctx }) => {
    if (!config.billing?.enabled) return { enabled: false as const, plans: [] };
    const db = ctx.prisma as unknown as BillingClient;
    const enrollment = await db.workspaceBilling.findUnique({
      where: { workspaceRef: ctx.workspace.accessKeyId }
    });
    return {
      enabled: true as const,
      currentPlanKey: enrollment?.planKey ?? null,
      plans: config.billing.plans.map((plan) => ({
        key: plan.key,
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        monthlyAllowance: plan.monthlyAllowance,
        rates: plan.rates
      }))
    };
  }),

  /** First paid plan: returns a Stripe-hosted Checkout URL (or subscribes directly). */
  subscribe: ownerProcedure
    .input(
      z.object({
        planKey: z.string().min(1),
        successUrl: z.string().url(),
        cancelUrl: z.string().url()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { billing, gateway: stripe } = requireStripe(ctx.stripeGateway);
      const subscribe = createSubscribeWorkspace(
        ctx.prisma as unknown as BillingClient,
        stripe,
        billing
      );
      return subscribe({
        workspaceRef: ctx.workspace.accessKeyId,
        planKey: input.planKey,
        ownerUserRef: ctx.user.ref,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl
      });
    }),

  /** Upgrade now (prorated) or schedule a downgrade for period end. */
  changePlan: ownerProcedure
    .input(z.object({ targetPlanKey: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { billing, gateway: stripe } = requireStripe(ctx.stripeGateway);
      const change = createChangePlan(ctx.prisma as unknown as BillingClient, stripe, billing);
      return change({
        workspaceRef: ctx.workspace.accessKeyId,
        targetPlanKey: input.targetPlanKey
      });
    }),

  /** Stripe-hosted customer portal (invoices + payment method). Owner-only. */
  portalSession: ownerProcedure
    .input(z.object({ returnUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const { gateway: stripe } = requireStripe(ctx.stripeGateway);
      const db = ctx.prisma as unknown as BillingClient;
      const enrollment = await db.workspaceBilling.findUnique({
        where: { workspaceRef: ctx.workspace.accessKeyId }
      });
      if (!enrollment) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "not_enrolled" });
      }
      const account = await db.billingAccount.findUnique({
        where: { id: enrollment.billingAccountId }
      });
      if (!account) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "not_enrolled" });
      }
      return stripe.createPortalSession({
        customerId: account.stripeCustomerId,
        returnUrl: input.returnUrl
      });
    })
});
