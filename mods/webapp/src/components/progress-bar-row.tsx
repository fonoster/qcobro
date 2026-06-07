import { cn } from "@/lib/utils.js";

export interface ProgressBarRowProps {
  label: string;
  value: number;
  max?: number;
  displayValue?: string;
  className?: string;
}

export function ProgressBarRow({
  label,
  value,
  max = 100,
  displayValue,
  className
}: ProgressBarRowProps) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-32 shrink-0 truncate text-sm text-slate-600">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2">
        <div
          className="h-2 rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-sm font-medium text-slate-700">
        {displayValue ?? `${Math.round(pct)}%`}
      </span>
    </div>
  );
}
