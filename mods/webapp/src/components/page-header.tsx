import { cn } from "@/lib/utils.js";

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold text-slate-900">{title}</h1>
        {description && <p className="text-sm font-normal text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
