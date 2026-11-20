import { useI18n } from "../lib/i18n.js";
import { Alert } from "./ui/alert.js";
import { Button } from "./ui/button.js";

export interface BillingPausedBannerProps {
  variant: "credits_exhausted" | "payment_failed";
  /** Owners get the CTA; admins see the informational banner (role-aware). */
  isOwner: boolean;
  onAction?: () => void;
  /** ISO date the billing cycle renews (billing.status `cycleEnd`); named in the exhausted copy. */
  renewsOn?: string | null;
}

/**
 * The "collections paused" banner (billing-console spec): an error Alert with full sentences
 * and, for owners, an outline action beside it — upgrade when credits are exhausted, fix the
 * payment method when the charge failed (explicitly NOT an upgrade prompt).
 */
export function BillingPausedBanner({
  variant,
  isOwner,
  onAction,
  renewsOn
}: BillingPausedBannerProps) {
  const { t, language } = useI18n();
  const exhausted = variant === "credits_exhausted";
  const renewal = renewsOn
    ? new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" })
        .format(new Date(renewsOn))
        .replace(/\./g, "")
        .replace(/ de /g, " ")
    : null;
  const body = exhausted
    ? renewal
      ? t("billing.paused.exhausted.bodyDated").replace("{date}", renewal)
      : t("billing.paused.exhausted.body")
    : t("billing.paused.paymentFailed.body");
  return (
    <div className="flex items-center gap-3">
      <Alert
        variant="error"
        className="min-w-0 flex-1"
        title={t(
          exhausted ? "billing.paused.exhausted.title" : "billing.paused.paymentFailed.title"
        )}
        description={body}
      />
      {isOwner && onAction && (
        <Button variant="outline" className="shrink-0" onClick={onAction}>
          {t(exhausted ? "billing.paused.exhausted.cta" : "billing.paused.paymentFailed.cta")}
        </Button>
      )}
    </div>
  );
}
