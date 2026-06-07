import { cn } from "@/lib/utils.js";

export interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export function KpiCard({ label, value, subtext, trend, className }: KpiCardProps) {
  return (
    <div className={cn("flex flex-col gap-2 border border-slate-200 bg-white p-5", className)}>
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
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
      {subtext && <p className="text-xs font-normal text-slate-500">{subtext}</p>}
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
