import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils.js";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className={cn("flex items-center gap-1 text-sm", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
            {isLast ? (
              <span className="font-medium text-slate-900">{item.label}</span>
            ) : item.href ? (
              <a href={item.href} className="text-slate-500 hover:text-slate-700">
                {item.label}
              </a>
            ) : (
              <span className="text-slate-400">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
