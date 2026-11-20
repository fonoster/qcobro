import type { ReactNode } from "react";
import { cn } from "@/lib/utils.js";
import { IconTile } from "./icon-tile.js";

export interface EmptyStateProps {
  /** A lucide icon element, e.g. <Folder />. */
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** The CTA, usually the page's primary create button. */
  action?: ReactNode;
  /** Draw without the card (inside a table or a panel that already has one). */
  bare?: boolean;
  className?: string;
}

/**
 * The one empty state for lists: a card with a 44 px icon tile, title 15/500, muted body
 * and an optional CTA, centered. Pass it to DataTable's `empty` or render it in place of a
 * list.
 *
 * @example <EmptyState icon={<Folder />} title="Aún no hay carteras" body="…" action={<Button>…</Button>} />
 */
export function EmptyState({ icon, title, body, action, bare, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-12 text-center",
        !bare && "rounded-card border border-border bg-surface",
        className
      )}
    >
      <IconTile>{icon}</IconTile>
      <p className="text-[15px] font-medium text-fg">{title}</p>
      {body && <p className="max-w-md text-[13px] text-fg-muted">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
