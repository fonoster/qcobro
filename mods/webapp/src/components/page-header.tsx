import type { ReactNode } from "react";
import { cn } from "@/lib/utils.js";

export interface PageHeaderProps {
  title: ReactNode;
  /** Subtitle: 13 muted, under the title. */
  description?: ReactNode;
  /** The page's primary actions ("Nueva cartera", a time filter…), right-aligned, gap 12. */
  actions?: ReactNode;
  /** @deprecated Use `actions`. */
  action?: ReactNode;
  /** Rendered above the title row (e.g. a Breadcrumb). */
  breadcrumb?: ReactNode;
  className?: string;
}

/**
 * A page's title row: title 22/600 and a muted subtitle on the left, the page's primary
 * actions on the right. List toolbars carry search, filters and a count, never the
 * page's create action.
 *
 * @example <PageHeader title="Carteras" description="…" actions={<Button><Plus />Nueva cartera</Button>} />
 */
export function PageHeader({
  title,
  description,
  actions,
  action,
  breadcrumb,
  className
}: PageHeaderProps) {
  const right = actions ?? action;
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {breadcrumb}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[22px] font-semibold leading-tight text-fg">{title}</h1>
          {description && <p className="text-[13px] text-fg-muted">{description}</p>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-3">{right}</div>}
      </div>
    </div>
  );
}
