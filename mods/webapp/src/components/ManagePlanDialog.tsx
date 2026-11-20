import { useState } from "react";
import { Info } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { Dialog } from "./ui/dialog.js";
import { Button } from "./ui/button.js";
import { Badge } from "./ui/badge.js";
import { Alert } from "./ui/alert.js";
import { resolveLocalizedString } from "../lib/localizedString.js";
import { formatBillingDate } from "./CreditMeterCard.js";
import { cn } from "@/lib/utils.js";

export interface ManagePlanDialogProps {
  open: boolean;
  onClose: () => void;
}

type Rates = Record<string, { perMessage?: number; perMinute?: number } | undefined>;

/** The rates shown on a plan card, in this order. */
const RATE_ROWS = [
  ["voiceAi", "billing.rate.voiceAi"],
  ["voicePrerecorded", "billing.rate.voicePrerecorded"],
  ["sms", "billing.rate.sms"],
  ["whatsappMessage", "billing.rate.whatsapp"],
  ["email", "billing.rate.email"]
] as const;

/** US$ with 2 to 4 decimals: "US$0.25", "US$0.005". */
function usd(n: number, minDigits = 2): string {
  return `US$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: 4
  }).format(n)}`;
}

/**
 * The "Gestionar plan" dialog (billing-console spec): the plans side by side in upgrade-path
 * order with their price, per-channel rates and the action that changes to them. It is the
 * comparison + entry point only — first-time subscriptions redirect to Stripe-hosted
 * Checkout, and upgrades/downgrades complete through the billing procedures (the console
 * never touches card data).
 */
export function ManagePlanDialog({ open, onClose }: ManagePlanDialogProps) {
  const { t, language } = useI18n();
  const { workspace } = useAuth();
  const utils = trpc.useUtils();
  const plans = trpc.billing.plans.useQuery(undefined, { enabled: open });
  const status = trpc.billing.status.useQuery(undefined, { enabled: open });
  const workspaces = trpc.workspaces.list.useQuery(undefined, { enabled: open });
  const subscribe = trpc.billing.subscribe.useMutation();
  const changePlan = trpc.billing.changePlan.useMutation();
  const [scheduledNote, setScheduledNote] = useState(false);
  const busy = subscribe.isPending || changePlan.isPending;

  const items = plans.data?.enabled ? plans.data.plans : [];
  const currentKey = plans.data?.enabled ? plans.data.currentPlanKey : null;
  const currentIndex = items.findIndex((p) => p.key === currentKey);
  const current = currentIndex >= 0 ? items[currentIndex] : null;
  const cycleEnd =
    status.data?.enabled && status.data.enrolled && status.data.cycleEnd
      ? formatBillingDate(status.data.cycleEnd, language)
      : null;
  const wsName = workspaces.data?.items.find((w) => w.accessKeyId === workspace)?.name;

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

  const subtitle =
    current && wsName
      ? t("billing.plans.subtitle")
          .replace("{ws}", wsName)
          .replace("{plan}", resolveLocalizedString(current.name, language))
          .replace("{date}", cycleEnd ?? "—")
      : t("billing.plans.subtitleNoPlan");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("billing.managePlan")}
      subtitle={subtitle}
      width={880}
      footer={
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      {(subscribe.isError || changePlan.isError) && (
        <Alert
          variant="error"
          title={t("billing.changeError")}
          description={t("billing.changeErrorBody")}
        />
      )}
      <div className="flex gap-3">
        {items.map((plan, index) => {
          const isCurrent = plan.key === currentKey;
          const isUpgrade = currentIndex === -1 || index > currentIndex;
          const rates = (plan as { rates?: Rates }).rates ?? {};
          return (
            <div
              key={plan.key}
              className={cn(
                "flex flex-1 flex-col gap-3.5 rounded-card border p-[18px]",
                isCurrent
                  ? "border-fg bg-elevated shadow-[0_0_0_0.5px_var(--color-fg)]"
                  : "border-border bg-bg"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold text-fg">
                  {resolveLocalizedString(plan.name, language)}
                </p>
                {isCurrent && (
                  <Badge className="rounded-md bg-surface px-2 py-0.5 text-xs">
                    {t("billing.currentPlan")}
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xl font-medium text-fg">
                  {usd(Number(plan.monthlyPrice))}
                </span>
                <span className="text-xs text-fg-muted">
                  {t("billing.plans.perMonth").replace(
                    "{amount}",
                    usd(Number(plan.monthlyAllowance))
                  )}
                </span>
              </div>
              <div className="h-px w-full bg-border" />
              <dl className="flex flex-col gap-1.5">
                {RATE_ROWS.map(([meter, label]) => {
                  const rate = rates[meter];
                  if (!rate) return null;
                  const value =
                    rate.perMinute !== undefined
                      ? `${usd(rate.perMinute)}/min`
                      : usd(rate.perMessage ?? 0);
                  return (
                    <div key={meter} className="flex justify-between gap-2 text-xs">
                      <dt className="text-fg-muted">{t(label)}</dt>
                      <dd className="font-mono text-fg">{value}</dd>
                    </div>
                  );
                })}
              </dl>
              <div className="mt-auto flex flex-col gap-1.5">
                {isCurrent ? (
                  <span className="text-xs text-fg-muted">
                    {cycleEnd ? t("billing.plans.renews").replace("{date}", cycleEnd) : null}
                  </span>
                ) : (
                  <>
                    <Button
                      type="button"
                      className="w-full"
                      variant={isUpgrade ? "default" : "outline"}
                      disabled={busy}
                      onClick={() => void choose(plan.key, isUpgrade)}
                    >
                      {t(
                        currentKey === null
                          ? "billing.choosePlan"
                          : isUpgrade
                            ? "billing.upgradeNow"
                            : "billing.downgrade"
                      )}
                    </Button>
                    {currentKey !== null && (
                      <span className="text-[11px] text-fg-muted">
                        {isUpgrade
                          ? t("billing.upgradeNote")
                          : cycleEnd
                            ? `${t("billing.downgradeNote")} · ${cycleEnd}`
                            : t("billing.downgradeNote")}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {scheduledNote && <p className="text-sm text-fg-muted">{t("billing.downgradeScheduled")}</p>}
      <div className="flex gap-2.5 rounded-control bg-elevated px-3 py-2.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted" />
        <p className="text-xs text-fg-muted">{t("billing.plans.note")}</p>
      </div>
    </Dialog>
  );
}
