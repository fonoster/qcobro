import { cn } from "@/lib/utils.js";

export interface StatusStripItem {
  label: string;
  value: string | number;
  color?: "emerald" | "amber" | "red" | "blue" | "gray";
}

export interface StatusStripProps {
  items: StatusStripItem[];
  className?: string;
}

const dotColors = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-400",
  red: "bg-red-500",
  blue: "bg-blue-500",
  gray: "bg-slate-400"
};

export function StatusStrip({ items, className }: StatusStripProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-6 border border-slate-200 bg-white px-4 py-2.5",
        className
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className={cn("h-2 w-2 rounded-full", dotColors[item.color ?? "gray"])} />
          <span className="text-slate-500">{item.label}</span>
          <span className="font-semibold text-slate-900">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
