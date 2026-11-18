import { useId } from "react";
import { Info } from "lucide-react";
import {
  RECOVERY_BREAKDOWN_DIMENSIONS,
  type RecoveryBreakdown,
  type RecoveryBreakdownRow
} from "@qcobro/common";
import { useI18n, type MessageId } from "../../lib/i18n.js";
import { OUTCOMES, outcomeLabel } from "../../lib/contactAxes.js";
import { cn } from "../../lib/utils.js";

export type RecoveryDimension = (typeof RECOVERY_BREAKDOWN_DIMENSIONS)[number];

/** The day buckets the API uses, in display order. All four always show, even at zero. */
const DAY_BUCKETS = ["0-1", "2-3", "4-7", "8+"];

type Translate = ReturnType<typeof useI18n>["t"];

function rowLabel(t: Translate, by: RecoveryDimension, row: RecoveryBreakdownRow): string {
  // Every row here had a gestión, so for Resultado NONE means no outcome and no path (an SMS).
  if (row.key === "NONE" && by === "OUTCOME") return t("portfolios.recovery.breakdown.noOutcome");
  if (row.key === "NONE") return t("portfolios.recovery.breakdown.none");
  switch (by) {
    case "CAMPAIGN":
      return row.name ?? row.key;
    case "CHANNEL":
      return t(`agents.type.${row.key}` as MessageId);
    case "OUTCOME":
      // The key is the outcome, or the path when the last gestión had no outcome.
      return (OUTCOMES as readonly string[]).includes(row.key)
        ? (outcomeLabel(t, row.key) ?? row.key)
        : t(`gestiones.path.${row.key}` as MessageId);
    case "DAYS_SINCE_TOUCH":
      return row.key.replace("-", "–");
  }
}

function rowsFor(by: RecoveryDimension, data: RecoveryBreakdown | undefined) {
  const rows = data?.rows ?? [];
  if (by !== "DAYS_SINCE_TOUCH") return rows;
  return DAY_BUCKETS.map(
    (key) => rows.find((r) => r.key === key) ?? { key, name: null, amount: 0, count: 0 }
  );
}

export interface RecoveryBreakdownCardProps {
  by: RecoveryDimension;
  onByChange: (by: RecoveryDimension) => void;
  data: RecoveryBreakdown | undefined;
  money: (value: number) => string;
}

/**
 * Recuperado split by campaign, channel, outcome or days since the last gestión. Every
 * dimension but Campaña adds up to Recuperado, so only those get a Total row; Campaña counts
 * an account once per campaign that worked it and says so instead.
 */
export function RecoveryBreakdownCard({ by, onByChange, data, money }: RecoveryBreakdownCardProps) {
  const { t } = useI18n();
  const name = useId();
  const rows = rowsFor(by, data);
  const additive = by !== "CAMPAIGN";
  const total = rows.reduce(
    (sum, r) => ({ amount: sum.amount + r.amount, count: sum.count + r.count }),
    { amount: 0, count: 0 }
  );
  const note =
    by === "CAMPAIGN"
      ? t("portfolios.recovery.breakdown.campaignNote")
      : by === "DAYS_SINCE_TOUCH"
        ? t("portfolios.recovery.breakdown.daysNote")
        : null;
  const title = t("portfolios.recovery.breakdown.title");

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {/* Native radios: arrow keys move the selection and screen readers announce it. */}
        <div
          role="radiogroup"
          aria-label={title}
          className="flex gap-0.5 rounded-lg border border-border bg-bg p-[3px]"
        >
          {RECOVERY_BREAKDOWN_DIMENSIONS.map((dim) => (
            <label
              key={dim}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 text-[13px] font-medium",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                by === dim ? "bg-elevated text-fg" : "text-fg-subtle hover:text-fg-muted"
              )}
            >
              <input
                type="radio"
                name={name}
                value={dim}
                checked={by === dim}
                onChange={() => onByChange(dim)}
                className="sr-only"
              />
              {t(`portfolios.recovery.breakdown.by.${dim}` as MessageId)}
            </label>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-subtle">
          {t("portfolios.recovery.emptyPeriod")}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-fg-subtle">
              <th className="py-2 font-medium">
                {t(`portfolios.recovery.breakdown.col.${by}` as MessageId)}
              </th>
              <th className="py-2 text-right font-medium">
                {t("portfolios.recovery.breakdown.col.amount")}
              </th>
              <th className="py-2 text-right font-medium">
                {t("portfolios.recovery.breakdown.col.count")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-b-0">
                <td className="py-2 text-fg">{rowLabel(t, by, row)}</td>
                <td className="py-2 text-right text-fg">{money(row.amount)}</td>
                <td className="py-2 text-right text-fg-subtle">{row.count.toLocaleString()}</td>
              </tr>
            ))}
            {additive && (
              <tr className="font-semibold">
                <td className="py-2 text-fg">{t("portfolios.recovery.breakdown.total")}</td>
                <td className="py-2 text-right text-fg">{money(total.amount)}</td>
                <td className="py-2 text-right text-fg">{total.count.toLocaleString()}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {note && (
        <p className="flex items-start gap-1.5 text-xs text-fg-subtle">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {note}
        </p>
      )}
    </div>
  );
}
