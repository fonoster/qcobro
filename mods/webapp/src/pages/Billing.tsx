import { useState } from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { activeRole } from "../lib/workspaceRole.js";
import { PageHeader } from "../components/page-header.js";
import { Panel } from "../components/panel.js";
import { Button } from "../components/ui/button.js";
import { CreditMeterCard } from "../components/CreditMeterCard.js";
import { BillingPausedBanner } from "../components/BillingPausedBanner.js";
import { ManagePlanDialog } from "../components/ManagePlanDialog.js";
import { resolveLocalizedString } from "../lib/localizedString.js";

/** Micro-units (1e-6) to a 2-decimal string, "12.80". */
function microToAmount(micro: number): string {
  return (Math.max(0, micro) / 1_000_000).toFixed(2);
}

/** One divided row of the Plan y pago panel: text on the left, an action on the right. */
function PlanRow({
  icon,
  title,
  sub,
  action
}: {
  icon?: React.ReactNode;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-fg">{title}</span>
          <span className="text-xs text-fg-muted">{sub}</span>
        </div>
      </div>
      {action}
    </div>
  );
}

/**
 * Facturación (billing-console spec): the credit meter and paused states are visible to
 * admins and owners; in the Plan y pago panel only the owner gets the actions — plan
 * changes and the Stripe-hosted portal for invoices/payment method. No card data or
 * invoice contents render in-app.
 */
export function Billing() {
  const { workspace, accessToken } = useAuth();
  const { t, language } = useI18n();
  const status = trpc.billing.status.useQuery();
  const data = status.data;
  const enrolled = !!data?.enabled && data.enrolled;
  const plans = trpc.billing.plans.useQuery(undefined, { enabled: enrolled });
  const portal = trpc.billing.portalSession.useMutation();
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const isOwner = activeRole(accessToken, workspace) === "WORKSPACE_OWNER";

  async function openPortal() {
    const session = await portal.mutateAsync({ returnUrl: `${window.location.origin}/billing` });
    window.open(session.url, "_blank", "noopener");
  }

  const plansData = plans.data;
  const currentPlan = plansData?.enabled
    ? plansData.plans.find((p) => p.key === plansData.currentPlanKey)
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("billing.title")} description={t("billing.subtitle")} />

      <div className="flex w-full max-w-[760px] flex-col gap-5">
        {data?.enabled && data.enrolled && data.paused && (
          <BillingPausedBanner
            variant={data.paused}
            isOwner={isOwner}
            onAction={() =>
              data.paused === "credits_exhausted" ? setPlanDialogOpen(true) : void openPortal()
            }
          />
        )}

        {data?.enabled === false && (
          <Panel title={t("billing.cycleCredits")}>
            <p className="text-[13px] text-fg-muted">{t("billing.disabled")}</p>
          </Panel>
        )}

        {data?.enabled && !data.enrolled && (
          <Panel title={t("billing.planAndPayment")}>
            <div className="flex items-center justify-between gap-4">
              <p className="text-[13px] text-fg-muted">{t("billing.notEnrolled")}</p>
              {isOwner && (
                <Button onClick={() => setPlanDialogOpen(true)}>{t("billing.choosePlan")}</Button>
              )}
            </div>
          </Panel>
        )}

        {data?.enabled && data.enrolled && (
          <>
            <CreditMeterCard
              balance={data.balance}
              allowance={data.allowance}
              consumed={microToAmount(data.allowanceMicro - data.balanceMicro)}
              remainingFraction={
                data.allowanceMicro > 0 ? data.balanceMicro / data.allowanceMicro : 0
              }
              renewsAt={data.cycleEnd}
              projectedDaysRemaining={data.projectedDaysRemaining}
              language={language}
            />

            <Panel title={t("billing.planAndPayment")} aside={t("billing.ownerOnly")}>
              <div className="flex flex-col">
                <PlanRow
                  title={t("billing.planName").replace(
                    "{plan}",
                    resolveLocalizedString(data.planName, language)
                  )}
                  sub={
                    currentPlan
                      ? t("billing.planTerms")
                          .replace("{price}", Number(currentPlan.monthlyPrice).toFixed(2))
                          .replace("{amount}", Number(currentPlan.monthlyAllowance).toFixed(2))
                      : t("billing.planTermsFallback").replace("{amount}", data.allowance)
                  }
                  action={
                    isOwner && (
                      <Button variant="outline" onClick={() => setPlanDialogOpen(true)}>
                        {t("billing.managePlan")}
                      </Button>
                    )
                  }
                />
                <div className="my-4 h-px bg-border" />
                <PlanRow
                  icon={<CreditCard className="h-[18px] w-[18px] shrink-0 text-fg-muted" />}
                  title={t("billing.paymentMethod")}
                  sub={t("billing.paymentMethodSub")}
                  action={
                    isOwner && (
                      <Button
                        variant="ghost"
                        disabled={portal.isPending}
                        onClick={() => void openPortal()}
                      >
                        {t("billing.update")}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )
                  }
                />
                <div className="my-4 h-px bg-border" />
                <PlanRow
                  title={t("billing.invoices")}
                  sub={t("billing.invoicesSub")}
                  action={
                    isOwner && (
                      <Button
                        variant="ghost"
                        disabled={portal.isPending}
                        onClick={() => void openPortal()}
                      >
                        {t("billing.viewInvoices")}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )
                  }
                />
              </div>
            </Panel>

            <p className="text-xs text-fg-muted">{t("billing.stripeNote")}</p>
          </>
        )}
      </div>

      <ManagePlanDialog open={planDialogOpen} onClose={() => setPlanDialogOpen(false)} />
    </div>
  );
}
