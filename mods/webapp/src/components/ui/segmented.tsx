import { cn } from "@/lib/utils.js";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

export interface SegmentedControlProps<V extends string> {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Accessible name of the group (e.g. "Periodo"). */
  "aria-label"?: string;
  className?: string;
}

/**
 * A neutral segmented control (--muted track, the active segment on --card), labels mono 12.
 * Used for page-level time filters in the page header.
 *
 * @example <SegmentedControl aria-label="Periodo" options={[{ value: "today", label: "Hoy" }, …]} value={p} onChange={setP} />
 */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  className,
  ...aria
}: SegmentedControlProps<V>) {
  return (
    <div
      role="radiogroup"
      {...aria}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[10px] bg-elevated p-[3px]",
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 font-mono text-xs transition-colors",
              active ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
