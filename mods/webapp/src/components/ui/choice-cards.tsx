import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils.js";

export interface ChoiceCardOption<V extends string> {
  value: V;
  title: string;
  description?: ReactNode;
  /** A lucide icon element shown before the text. */
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ChoiceCardGroupProps<V extends string> {
  label?: string;
  options: ChoiceCardOption<V>[];
  value: V | null | undefined;
  onChange: (value: V) => void;
  /** Stack the cards (default: side by side). */
  vertical?: boolean;
  name?: string;
  className?: string;
}

/**
 * Radio choice cards, neutral: the selected card has a foreground stroke and --muted fill,
 * the radio sits on the right. Native radios underneath, so getByRole("radio") and labels work.
 *
 * @example <ChoiceCardGroup label="Modo" options={[{ value: "merge", title: "Combinar", description: "No archiva" }]} value={m} onChange={setM} vertical />
 */
export function ChoiceCardGroup<V extends string>({
  label,
  options,
  value,
  onChange,
  vertical,
  name,
  className
}: ChoiceCardGroupProps<V>) {
  const autoName = useId();
  const groupName = name ?? autoName;
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-xs font-medium text-fg">{label}</span>}
      <div className={cn("flex gap-2", vertical ? "flex-col" : "flex-row")}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "relative flex flex-1 cursor-pointer items-start gap-2.5 rounded-control border px-3.5 py-3 transition-colors",
                selected
                  ? "border-fg bg-elevated shadow-[0_0_0_0.5px_var(--color-fg)]"
                  : "border-border bg-bg hover:border-fg-muted",
                o.disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {o.icon && (
                <span
                  className={cn(
                    "mt-0.5 flex shrink-0 [&>svg]:h-4 [&>svg]:w-4",
                    selected ? "text-fg" : "text-fg-muted"
                  )}
                >
                  {o.icon}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium text-fg">{o.title}</span>
                {o.description && <span className="text-xs text-fg-muted">{o.description}</span>}
              </span>
              <input
                type="radio"
                name={groupName}
                value={o.value}
                checked={selected}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
              />
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 rounded-full border peer-focus-visible:ring-2 peer-focus-visible:ring-fg",
                  selected ? "border-[5px] border-fg" : "border-input"
                )}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
