import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils.js";

export interface FilterChipOption {
  value: string;
  label: string;
}

export interface FilterChipProps {
  /** The dimension ("Canal"). The chip reads "Canal: Todos". */
  label: string;
  value: string;
  options: FilterChipOption[];
  onChange: (value: string) => void;
  /** The "no filter" value; the chip is drawn active (foreground stroke) when value differs. */
  allValue?: string;
  className?: string;
}

/**
 * A toolbar filter chip, "Label: value ▾", 38 px. The control is a native select laid over
 * the chip, so it stays keyboard- and screen-reader-friendly (role combobox, name = label).
 *
 * @example <FilterChip label="Canal" value={ch} allValue="" options={[{ value: "", label: "Todos" }, …]} onChange={setCh} />
 */
export function FilterChip({
  label,
  value,
  options,
  onChange,
  allValue = "",
  className
}: FilterChipProps) {
  const current = options.find((o) => o.value === value)?.label ?? value;
  const active = value !== allValue;
  return (
    <div
      className={cn(
        "relative inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-control border bg-surface px-3 text-[13px] text-fg focus-within:border-fg",
        active ? "border-fg" : "border-border",
        className
      )}
    >
      <span>
        <span className="text-fg-muted">{label}:</span> {current}
      </span>
      <ChevronDown aria-hidden className="h-3.5 w-3.5 text-fg-muted" />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
