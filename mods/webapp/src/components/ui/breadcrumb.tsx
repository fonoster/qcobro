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
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-fg-subtle" />}
            {isLast ? (
              <span className="font-medium text-fg">{item.label}</span>
            ) : item.href ? (
              <a href={item.href} className="text-fg-subtle hover:text-fg-muted">
                {item.label}
              </a>
            ) : (
              <span className="text-fg-subtle">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
