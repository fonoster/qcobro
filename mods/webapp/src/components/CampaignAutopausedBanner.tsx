import { useI18n } from "../lib/i18n.js";
import { Alert } from "./ui/alert.js";

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
    <Alert
      variant="warning"
      title={t("campaigns.detail.autopaused.title")}
      description={t("campaigns.detail.autopaused.body")}
    />
  );
}
