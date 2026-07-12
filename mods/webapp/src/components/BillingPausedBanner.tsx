import { CircleAlert, CreditCard } from "lucide-react";
import { useI18n } from "../lib/i18n.js";
import { Button } from "./ui/button.js";

export interface BillingPausedBannerProps {
  variant: "credits_exhausted" | "payment_failed";
  /** Owners get the CTA; admins see the informational banner (role-aware). */
  isOwner: boolean;
  onAction?: () => void;
}

/**
 * The "collections paused" banner (billing-console spec): amber for credits
 * exhausted (owner CTA: upgrade), red for payment failure (owner CTA: fix the
 * payment method — explicitly NOT an upgrade prompt).
 */
export function BillingPausedBanner({ variant, isOwner, onAction }: BillingPausedBannerProps) {
  const { t } = useI18n();
  const exhausted = variant === "credits_exhausted";
  const Icon = exhausted ? CircleAlert : CreditCard;
  return (
    <div
      role="alert"
      className={`flex items-center gap-4 rounded-xl border p-4 ${
        exhausted ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          exhausted ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${exhausted ? "text-amber-800" : "text-red-800"}`}>
          {t(exhausted ? "billing.paused.exhausted.title" : "billing.paused.paymentFailed.title")}
        </p>
        <p className={`text-sm ${exhausted ? "text-amber-700" : "text-red-700"}`}>
          {t(exhausted ? "billing.paused.exhausted.body" : "billing.paused.paymentFailed.body")}
        </p>
      </div>
      {isOwner && onAction && (
        <Button
          onClick={onAction}
          className={exhausted ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"}
        >
          {t(exhausted ? "billing.paused.exhausted.cta" : "billing.paused.paymentFailed.cta")}
        </Button>
      )}
    </div>
  );
}
