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
  emerald: "bg-primary",
  amber: "bg-warning",
  red: "bg-danger",
  blue: "bg-info",
  gray: "bg-fg-subtle"
};

export function StatusStrip({ items, className }: StatusStripProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-6 border border-border bg-surface px-4 py-2.5",
        className
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className={cn("h-2 w-2 rounded-full", dotColors[item.color ?? "gray"])} />
          <span className="text-fg-subtle">{item.label}</span>
          <span className="font-semibold text-fg">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
