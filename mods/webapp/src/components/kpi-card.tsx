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
  /** A second note under `subtext`, for a figure that qualifies the main one. */
  detail?: string;
  /** Classes for the `subtext` note (its color), when it should read stronger than `detail`. */
  subtextClassName?: string;
  trend?: { value: string; positive: boolean };
  className?: string;
  /** Optional in-card period pill, right-aligned next to the label (the "KPI Card Period"
   *  Pencil variant). Only the cards that pass this prop render the pill; every other
   *  `KpiCard` in the app renders exactly as before. */
  period?: KpiCardPeriodControl;
  /** Places the notes directly under the value instead of pinning them to the card's bottom
   *  edge (the Panel design). Off by default, so every other `KpiCard` renders as before. */
  notesUnderValue?: boolean;
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
    <div className="relative inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2 py-1 focus-within:ring-2 focus-within:ring-border">
      <Calendar className="h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />
      {/* Hidden from assistive tech: the overlaying select is still in the a11y tree with its
          own aria-label, so an unhidden span would announce the period a second time. */}
      <span aria-hidden="true" className="text-xs font-medium text-fg">
        {current?.label ?? value}
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />
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

export function KpiCard({
  label,
  value,
  subtext,
  detail,
  subtextClassName,
  trend,
  className,
  period,
  notesUnderValue = false
}: KpiCardProps) {
  return (
    // A named group so the value and its notes are announced (and found) with their label.
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex flex-col gap-2 rounded-card border border-border bg-surface p-5",
        className
      )}
    >
      {period ? (
        // The control wraps under the label rather than truncating it: at five cards across a
        // 1280px viewport each card is ~180px, too narrow for both on one line.
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <p className="whitespace-nowrap text-xs font-normal text-fg-subtle">{label}</p>
          <KpiCardPeriodSelect {...period} />
        </div>
      ) : (
        <p className="whitespace-nowrap text-xs font-normal text-fg-subtle">{label}</p>
      )}
      <p className="whitespace-nowrap font-mono text-[22px] font-medium leading-tight text-fg min-[1440px]:text-2xl">
        {value}
      </p>
      {/* `mt-auto` pins the footer to the bottom of the card so every card's note sits on the
          same baseline across the row. Without it the notes float directly under their values,
          and any card with a taller header — the contact-rate card, whose label row carries the
          period control — pushes its note out of line with the rest. */}
      {(trend || subtext || detail) && (
        <div className={cn("flex flex-col gap-1", !notesUnderValue && "mt-auto")}>
          {trend && (
            <p
              className={cn("text-xs font-normal", trend.positive ? "text-primary" : "text-danger")}
            >
              {trend.value}
            </p>
          )}
          {/* slate-400, matching the sibling KPI cards Home renders inline — the contact-rate
              card sits in that same row and a 100-level difference reads as a mistake. */}
          {subtext && (
            <p className={cn("text-xs font-normal text-fg-subtle", subtextClassName)}>{subtext}</p>
          )}
          {detail && <p className="text-xs font-normal text-fg-subtle">{detail}</p>}
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
