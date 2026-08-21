import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils.js";

export interface KpiCardPeriodOption {
  value: string;
  label: string;
}

export interface KpiCardPeriodControl {
  value: string;
  options: KpiCardPeriodOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: { value: string; positive: boolean };
  className?: string;
  /** Optional in-card period pill, right-aligned next to the label (the "KPI Card Period"
   *  Pencil variant). Only the cards that pass this prop render the pill; every other
   *  `KpiCard` in the app renders exactly as before. */
  period?: KpiCardPeriodControl;
}

/** The period pill for `KpiCard`'s `period` prop: calendar icon, current selection, chevron. */
function KpiCardPeriodSelect({ value, options, onChange, ariaLabel }: KpiCardPeriodControl) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
      <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent text-xs font-medium text-slate-900 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
    </div>
  );
}

export function KpiCard({ label, value, subtext, trend, className, period }: KpiCardProps) {
  return (
    <div className={cn("flex flex-col gap-2 border border-slate-200 bg-white p-5", className)}>
      {period ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-slate-500">{label}</p>
          <KpiCardPeriodSelect {...period} />
        </div>
      ) : (
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
      )}
      <p className="text-[28px] font-bold leading-tight text-slate-900">{value}</p>
      {trend && (
        <p
          className={cn(
            "text-xs font-normal",
            trend.positive ? "text-emerald-600" : "text-red-500"
          )}
        >
          {trend.value}
        </p>
      )}
      {/* slate-400, matching the sibling KPI cards Home renders inline — the contact-rate card
          sits in that same row and a 100-level difference reads as a mistake side by side. */}
      {subtext && <p className="text-xs font-normal text-slate-400">{subtext}</p>}
    </div>
  );
}

export interface KpiRowProps {
  cards: KpiCardProps[];
  className?: string;
}

export function KpiRow({ cards, className }: KpiRowProps) {
  return (
    <div className={cn("grid gap-4", `grid-cols-${Math.min(cards.length, 4)}`, className)}>
      {cards.map((card, i) => (
        <KpiCard key={i} {...card} />
      ))}
    </div>
  );
}
