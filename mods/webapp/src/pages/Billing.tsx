import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { activeRole } from "../lib/workspaceRole.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { CreditMeterCard } from "../components/CreditMeterCard.js";
import { BillingPausedBanner } from "../components/BillingPausedBanner.js";
import { ManagePlanDialog } from "../components/ManagePlanDialog.js";
import { resolveLocalizedString } from "../lib/localizedString.js";

/**
 * Facturación (billing-console spec): the credit meter and paused states are
 * visible to admins and owners; the Plan y pago card — plan changes and the
 * Stripe-hosted portal for invoices/payment method — is owner-only. No card
 * data or invoice contents render in-app.
 */
export function Billing() {
  const { workspace, accessToken } = useAuth();
  const { t, language } = useI18n();
  const status = trpc.billing.status.useQuery();
  const portal = trpc.billing.portalSession.useMutation();
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const isOwner = activeRole(accessToken, workspace) === "WORKSPACE_OWNER";

  async function openPortal() {
    const session = await portal.mutateAsync({ returnUrl: `${window.location.origin}/billing` });
    window.open(session.url, "_blank", "noopener");
  }

  const data = status.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900">{t("billing.title")}</h1>
        <p className="text-sm text-slate-500">{t("billing.subtitle")}</p>
      </div>

      {data?.enabled && data.enrolled && data.paused && (
        <div className="max-w-[680px]">
          <BillingPausedBanner
            variant={data.paused}
            isOwner={isOwner}
            onAction={() =>
              data.paused === "credits_exhausted" ? setPlanDialogOpen(true) : void openPortal()
            }
          />
        </div>
      )}

      {data?.enabled === false && (
        <Card className="max-w-[680px] rounded-xl border-slate-200 p-6 text-sm text-slate-500 shadow-none">
          {t("billing.disabled")}
        </Card>
      )}

      {data?.enabled && !data.enrolled && (
        <Card className="max-w-[680px] rounded-xl border-slate-200 shadow-none">
          <div className="flex items-center justify-between gap-4 p-6">
            <p className="text-sm text-slate-500">{t("billing.notEnrolled")}</p>
            {isOwner && (
              <Button onClick={() => setPlanDialogOpen(true)}>{t("billing.choosePlan")}</Button>
            )}
          </div>
        </Card>
      )}

      {data?.enabled && data.enrolled && (
        <CreditMeterCard
          planName={resolveLocalizedString(data.planName, language)}
          balance={data.balance}
          allowance={data.allowance}
          remainingFraction={data.allowanceMicro > 0 ? data.balanceMicro / data.allowanceMicro : 0}
          renewsAt={data.cycleEnd}
          projectedDaysRemaining={data.projectedDaysRemaining}
          language={language}
        />
      )}

      {isOwner && data?.enabled && data.enrolled && (
        <Card className="max-w-[680px] rounded-xl border-slate-200 shadow-none">
          <div className="flex flex-col gap-4 p-6">
            <h2 className="text-[15px] font-semibold text-slate-900">
              {t("billing.planAndPayment")}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setPlanDialogOpen(true)}>{t("billing.managePlan")}</Button>
              <Button
                variant="outline"
                disabled={portal.isPending}
                onClick={() => void openPortal()}
              >
                {t("billing.updatePayment")}
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                disabled={portal.isPending}
                onClick={() => void openPortal()}
              >
                {t("billing.viewInvoices")}
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-slate-400">{t("billing.stripeNote")}</p>
          </div>
        </Card>
      )}

      <ManagePlanDialog open={planDialogOpen} onClose={() => setPlanDialogOpen(false)} />
    </div>
  );
}
