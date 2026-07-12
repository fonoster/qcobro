import type { Request, Response } from "express";
import type Stripe from "stripe";
import type { BillingClient, BillingConfig } from "@qcobro/common";
import {
  handleStripeEvent,
  type BillingStripeEvent
} from "../functions/billing/handleStripeEvent.js";
import type { StripeGateway } from "../functions/billing/stripeGateway.js";

/**
 * `POST /api/stripe/webhook` — verifies the Stripe signature against the raw
 * body (captured by the json middleware's `verify` hook), maps the event to the
 * minimal billing shapes, and applies it. Effects are idempotent, so Stripe's
 * redelivery semantics are safe; unrecognized event types are acknowledged and
 * ignored.
 */
export function createStripeWebhookHandler(
  db: BillingClient,
  sdk: Stripe,
  gateway: StripeGateway,
  billing: NonNullable<BillingConfig>
) {
  return async (req: Request, res: Response): Promise<void> => {
    let event: Stripe.Event;
    try {
      const rawBody = (req as Request & { rawBody?: string }).rawBody ?? "";
      event = sdk.webhooks.constructEvent(
        rawBody,
        req.headers["stripe-signature"] as string,
        billing.stripe!.webhookSigningSecret
      );
    } catch {
      res.status(400).json({ error: "Invalid Stripe signature" });
      return;
    }

    const mapped = mapEvent(event);
    if (!mapped) {
      res.status(200).json({ received: true, ignored: event.type });
      return;
    }

    try {
      await handleStripeEvent(db, gateway, billing, mapped);
      res.status(200).json({ received: true });
    } catch (err) {
      // Non-2xx makes Stripe retry — correct for transient DB failures because
      // every effect is idempotent.
      console.error(
        `[billing] stripe webhook ${event.type} failed:`,
        err instanceof Error ? err.message : err
      );
      res.status(500).json({ error: "Webhook handling failed" });
    }
  };
}

function asId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Narrow a Stripe event to the billing shapes; null = acknowledged, ignored. */
export function mapEvent(event: Stripe.Event): BillingStripeEvent | null {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const customerId = asId(session.customer);
    const subscriptionId = asId(session.subscription);
    const meta = session.metadata ?? {};
    if (
      !customerId ||
      !subscriptionId ||
      !meta.workspaceRef ||
      !meta.ownerUserRef ||
      !meta.planKey
    ) {
      return null; // not a QCobro-initiated checkout
    }
    return {
      type: "checkout.session.completed",
      checkoutSessionId: session.id,
      customerId,
      subscriptionId,
      workspaceRef: meta.workspaceRef,
      ownerUserRef: meta.ownerUserRef,
      planKey: meta.planKey
    };
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const customerId = asId(invoice.customer);
    if (!customerId) return null;
    if (event.type === "invoice.payment_failed") {
      return { type: "invoice.payment_failed", customerId };
    }
    const parent = invoice.parent as {
      subscription_details?: { subscription?: string | { id: string } };
    } | null;
    return {
      type: "invoice.paid",
      invoiceId: invoice.id ?? "",
      customerId,
      subscriptionId: asId(parent?.subscription_details?.subscription),
      billingReason: invoice.billing_reason ?? null
    };
  }
  return null;
}
