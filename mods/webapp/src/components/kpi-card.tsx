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

/**
 * The period pill for `KpiCard`'s `period` prop: calendar icon, current selection, chevron.
 *
 * The `<select>` is transparent and stretched over the whole pill rather than sitting inline
 * between the two icons. Inline, only the text opened the menu — clicking the calendar or the
 * chevron did nothing, which is exactly where people aim. Overlaying it makes the entire pill
 * the hit area while keeping a real native select underneath for keyboard and screen readers.
 */
function KpiCardPeriodSelect({ value, options, onChange, ariaLabel }: KpiCardPeriodControl) {
  const current = options.find((option) => option.value === value);
  return (
    // Tight padding/gap on purpose: five cards share the row, so at a 1280px viewport each is
    // ~182px and every pixel the pill takes comes straight off the label beside it.
    <div className="relative inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 focus-within:ring-2 focus-within:ring-slate-300">
      <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
      {/* Hidden from assistive tech: the overlaying select is still in the a11y tree with its
          own aria-label, so an unhidden span would announce the period a second time. */}
      <span aria-hidden="true" className="text-xs font-medium text-slate-900">
        {current?.label ?? value}
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function KpiCard({ label, value, subtext, trend, className, period }: KpiCardProps) {
  return (
    <div className={cn("flex flex-col gap-2 border border-slate-200 bg-white p-5", className)}>
      {period ? (
        // `min-w-0` + `truncate` on the label so it yields space to the control instead of
        // crowding it: at five cards across a narrow viewport there isn't room for both at
        // full width, and the label is the half that degrades gracefully.
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[13px] font-medium text-slate-500">{label}</p>
          <KpiCardPeriodSelect {...period} />
        </div>
      ) : (
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
      )}
      <p className="text-[28px] font-bold leading-tight text-slate-900">{value}</p>
      {/* `mt-auto` pins the footer to the bottom of the card so every card's note sits on the
          same baseline across the row. Without it the notes float directly under their values,
          and any card with a taller header — the contact-rate card, whose label row carries the
          period control — pushes its note out of line with the rest. */}
      {(trend || subtext) && (
        <div className="mt-auto flex flex-col gap-1">
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
          {/* slate-400, matching the sibling KPI cards Home renders inline — the contact-rate
              card sits in that same row and a 100-level difference reads as a mistake. */}
          {subtext && <p className="text-xs font-normal text-slate-400">{subtext}</p>}
        </div>
      )}
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
