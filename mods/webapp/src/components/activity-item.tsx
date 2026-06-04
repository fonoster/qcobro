import { cn } from "@/lib/utils.js";
import { Check } from "lucide-react";

export interface ActivityItemProps {
  actor?: string;
  action: string;
  target?: string;
  timestamp?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function ActivityItem({ actor, action, target, timestamp, icon, className }: ActivityItemProps) {
  return (
    <div className={cn("flex items-center gap-3 px-5 py-2.5 border-b border-slate-100 last:border-b-0", className)}>
      {icon ?? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
          <Check className="h-4 w-4 text-emerald-500" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <p className="text-[13px] font-medium text-slate-900 truncate">
          {actor && <>{actor} — </>}
          {action}
          {target && <> {target}</>}
        </p>
        {timestamp && <p className="text-[11px] font-normal text-slate-500">{timestamp}</p>}
      </div>
    </div>
  );
}
