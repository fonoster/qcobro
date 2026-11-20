import { cn } from "@/lib/utils.js";
import { useI18n, type MessageId } from "@/lib/i18n.js";

/** ISO weekdays, 1 = Monday … 7 = Sunday. */
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export interface DayPickerProps {
  /** Selected ISO weekdays (1 = Monday … 7 = Sunday). */
  value: number[];
  onChange: (days: number[]) => void;
  "aria-label"?: string;
  invalid?: boolean;
  className?: string;
}

/**
 * The campaign day picker: seven 36 px neutral squares (L M X J V S D, mono); a selected
 * day has the --secondary fill and a foreground border. Toggle buttons with aria-pressed
 * and the full day name as their accessible name.
 *
 * @example <DayPicker value={daysOfWeek} onChange={setDaysOfWeek} />
 */
export function DayPicker({ value, onChange, invalid, className, ...aria }: DayPickerProps) {
  const { t } = useI18n();
  function toggle(d: number) {
    onChange(
      value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b)
    );
  }
  return (
    <div role="group" {...aria} className={cn("flex gap-2", className)}>
      {DAYS.map((d) => {
        const selected = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={selected}
            aria-label={t(`campaigns.days.${d}` as MessageId)}
            onClick={() => toggle(d)}
            className={cn(
              "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border font-mono text-[13px] transition-colors",
              selected
                ? "border-fg bg-elevated text-fg"
                : cn(
                    "bg-bg text-fg-muted hover:text-fg",
                    invalid ? "border-danger" : "border-input"
                  )
            )}
          >
            {t(`campaigns.dayLetter.${d}` as MessageId)}
          </button>
        );
      })}
    </div>
  );
}
