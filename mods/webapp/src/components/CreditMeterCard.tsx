import { useI18n } from "../lib/i18n.js";
import { Panel } from "./panel.js";

export interface CreditMeterCardProps {
  /** Display-rounded amounts with no currency symbol ("16.20"); the card prefixes US$. */
  balance: string;
  allowance: string;
  /** Spent so far this cycle ("12.80"), or null to hide it. */
  consumed: string | null;
  /** 0..1 fraction of the allowance still available. */
  remainingFraction: number;
  /** ISO date the cycle renews, or null before the first invoice. */
  renewsAt: string | null;
  /** Burn-rate projection; null hides the hint (no usage yet). */
  projectedDaysRemaining: number | null;
  language: string;
}

/** "1 ago 2026": day, short month without its period, year. */
export function formatBillingDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(iso))
    .replace(/\./g, "");
}

/**
 * The "Créditos del ciclo" panel (billing-console spec): the renewal date at the header's
 * right, the remaining balance (mono 28) of the allowance, a progress bar, consumption and
 * the projected-days hint, and a footnote. Purely presentational — the Facturación page
 * feeds it from `billing.status`.
 */
export function CreditMeterCard(props: CreditMeterCardProps) {
  const { t } = useI18n();
  const pct = Math.round(Math.min(1, Math.max(0, props.remainingFraction)) * 100);
  const low = pct <= 15;
  const renews = props.renewsAt ? formatBillingDate(props.renewsAt, props.language) : null;

  return (
    <Panel
      title={t("billing.cycleCredits")}
      aside={renews ? t("billing.renews").replace("{date}", renews) : undefined}
    >
      <div className="flex items-end gap-2">
        <span className="font-mono text-[28px] font-medium leading-none text-fg">
          US${props.balance}
        </span>
        <span className="text-[13px] text-fg-muted">
          {t("billing.ofRemaining").replace("{allowance}", `US$${props.allowance}`)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-elevated"
      >
        <div
          className={`h-full rounded-full ${low ? "bg-warning" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {(props.consumed !== null || props.projectedDaysRemaining !== null) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-fg-muted">
          <span>
            {props.consumed !== null &&
              t("billing.consumed").replace("{amount}", `US$${props.consumed}`)}
          </span>
          {props.projectedDaysRemaining !== null && (
            <span>
              {t("billing.projectedDays").replace("{days}", String(props.projectedDaysRemaining))}
            </span>
          )}
        </div>
      )}
      <p className="text-xs text-fg-muted">{t("billing.allowanceNote")}</p>
    </Panel>
  );
}
