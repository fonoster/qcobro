import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { Dialog } from "./ui/dialog.js";
import { Button } from "./ui/button.js";
import { resolveLocalizedString } from "../lib/localizedString.js";

export interface ManagePlanDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The "Gestionar plan" modal (billing-console spec): the ordered upgrade path
 * with per-plan price and included credits. It is the comparison + entry point
 * only — first-time subscriptions redirect to Stripe-hosted Checkout, and
 * upgrades/downgrades complete through the billing procedures (the console
 * never touches card data).
 */
export function ManagePlanDialog({ open, onClose }: ManagePlanDialogProps) {
  const { t, language } = useI18n();
  const utils = trpc.useUtils();
  const plans = trpc.billing.plans.useQuery(undefined, { enabled: open });
  const subscribe = trpc.billing.subscribe.useMutation();
  const changePlan = trpc.billing.changePlan.useMutation();
  const [scheduledNote, setScheduledNote] = useState(false);
  const busy = subscribe.isPending || changePlan.isPending;

  const items = plans.data?.enabled ? plans.data.plans : [];
  const currentKey = plans.data?.enabled ? plans.data.currentPlanKey : null;
  const currentIndex = items.findIndex((p) => p.key === currentKey);

  async function choose(planKey: string, isUpgrade: boolean) {
    if (currentKey === null) {
      // First paid plan: finish on Stripe-hosted Checkout.
      const result = await subscribe.mutateAsync({
        planKey,
        successUrl: `${window.location.origin}/billing?checkout=success`,
        cancelUrl: `${window.location.origin}/billing?checkout=cancelled`
      });
      if (result.kind === "checkout") {
        window.location.assign(result.url);
        return;
      }
    } else {
      const result = await changePlan.mutateAsync({ targetPlanKey: planKey });
      if (result.kind === "downgrade_scheduled") setScheduledNote(true);
    }
    await Promise.all([utils.billing.status.invalidate(), utils.billing.plans.invalidate()]);
    if (isUpgrade) onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("billing.managePlan")}>
      <div className="flex flex-col gap-3">
        {items.map((plan, index) => {
          const isCurrent = plan.key === currentKey;
          const isUpgrade = currentIndex === -1 || index > currentIndex;
          return (
            <div
              key={plan.key}
              className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${
                isCurrent ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {resolveLocalizedString(plan.name, language)}
                  </p>
                  {isCurrent && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {t("billing.currentPlan")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {t("billing.monthlyPrice").replace("{price}", String(plan.monthlyPrice))} ·{" "}
                  {t("billing.includedCredits").replace("{amount}", String(plan.monthlyAllowance))}
                </p>
              </div>
              {!isCurrent && (
                <div className="flex flex-col items-end gap-1">
                  <Button
                    variant={isUpgrade ? "default" : "outline"}
                    disabled={busy}
                    onClick={() => void choose(plan.key, isUpgrade)}
                  >
                    {t(isUpgrade ? "billing.upgradeNow" : "billing.downgrade")}
                  </Button>
                  <span className="text-[11px] text-slate-400">
                    {t(isUpgrade ? "billing.upgradeNote" : "billing.downgradeNote")}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {scheduledNote && (
          <p className="text-sm text-slate-500">{t("billing.downgradeScheduled")}</p>
        )}
        {(subscribe.isError || changePlan.isError) && (
          <p className="text-sm text-red-600">{t("billing.changeError")}</p>
        )}
      </div>
    </Dialog>
  );
}
