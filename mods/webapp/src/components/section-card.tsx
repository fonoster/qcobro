import { cn } from "@/lib/utils.js";

export interface SectionCardProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, description, action, children, className }: SectionCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {description && <p className="text-xs text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
