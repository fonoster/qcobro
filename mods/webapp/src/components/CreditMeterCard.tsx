import { useI18n } from "../lib/i18n.js";
import { Card } from "./ui/card.js";

export interface CreditMeterCardProps {
  planName: string;
  /** Display-rounded amounts (already currency-formatted upstream). */
  balance: string;
  allowance: string;
  /** 0..1 fraction of the allowance still available. */
  remainingFraction: number;
  /** ISO date the cycle renews, or null before the first invoice. */
  renewsAt: string | null;
  /** Burn-rate projection; null hides the hint (no usage yet). */
  projectedDaysRemaining: number | null;
  language: string;
}

/**
 * The "Créditos del ciclo" card (billing-console spec): plan pill, remaining vs
 * allowance, progress bar, renewal date, and the projected-days hint. Purely
 * presentational — the Facturación page feeds it from `billing.status`.
 */
export function CreditMeterCard(props: CreditMeterCardProps) {
  const { t } = useI18n();
  const pct = Math.round(Math.min(1, Math.max(0, props.remainingFraction)) * 100);
  const low = pct <= 15;
  const renews = props.renewsAt
    ? new Intl.DateTimeFormat(props.language, {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(new Date(props.renewsAt))
    : null;

  return (
    <Card className="max-w-[680px] rounded-xl border-slate-200 shadow-none">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-slate-900">{t("billing.cycleCredits")}</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {props.planName}
          </span>
        </div>
        <div>
          <p className="text-[22px] font-bold text-slate-900">
            {t("billing.remaining")
              .replace("{balance}", props.balance)
              .replace("{allowance}", props.allowance)}
          </p>
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className={`h-full rounded-full ${low ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          {renews && <span>{t("billing.renews").replace("{date}", renews)}</span>}
          {props.projectedDaysRemaining !== null && (
            <span className="text-slate-400">
              {t("billing.projectedDays").replace("{days}", String(props.projectedDaysRemaining))}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
