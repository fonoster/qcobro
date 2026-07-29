import { CircleAlert } from "lucide-react";
import { useI18n } from "../lib/i18n.js";

/**
 * Shown on the campaign detail view when the campaign auto-paused itself
 * (`pauseReason === "AUTO_ERROR_THRESHOLD"`) after a run of consecutive
 * SYSTEM_ERROR dispatch failures (outreach-failure-classification). Purely
 * informational — reactivation is the existing manual PAUSED → ACTIVE action
 * already in the page header, so this carries no separate CTA, unlike
 * {@link BillingPausedBanner}.
 */
export function CampaignAutopausedBanner() {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <CircleAlert className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-800">
          {t("campaigns.detail.autopaused.title")}
        </p>
        <p className="text-sm text-amber-700">{t("campaigns.detail.autopaused.body")}</p>
      </div>
    </div>
  );
}
