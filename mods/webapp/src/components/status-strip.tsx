import { cn } from "@/lib/utils.js";

export interface StatusStripItem {
  label: string;
  value: string | number;
}

export interface StatusStripProps {
  items: StatusStripItem[];
  className?: string;
}

export function StatusStrip({ items, className }: StatusStripProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-6 rounded-card border border-border bg-surface px-4 py-2.5",
        className
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-fg-subtle">{item.label}</span>
          <span className="font-semibold text-fg">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
