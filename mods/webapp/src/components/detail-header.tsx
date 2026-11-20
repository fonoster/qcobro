import type { ReactNode } from "react";
import { cn } from "@/lib/utils.js";
import { IconTile } from "./ui/icon-tile.js";

export interface DetailHeaderProps {
  /** A lucide icon element (e.g. <Megaphone />) or initials text for the 44 px tile. */
  icon: ReactNode;
  title: ReactNode;
  /** A badge (or badges) beside the name. */
  badge?: ReactNode;
  /** The muted sub-line under the name ("Voz IA · Español (Latinoamérica) · Carla"). */
  meta?: ReactNode;
  /** Right-aligned actions (Editar, Pausar…). */
  actions?: ReactNode;
  className?: string;
}

/**
 * A detail page's identity: 44 px icon tile, name 20/600 with a badge beside it, and a
 * sub-line; actions on the right. Put a Breadcrumb above it.
 *
 * @example <DetailHeader icon={<Megaphone />} title={c.name} badge={<Badge>Activa</Badge>} meta="Voz IA · Carla" actions={…} />
 */
export function DetailHeader({ icon, title, badge, meta, actions, className }: DetailHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 items-center gap-3.5">
        <IconTile>{icon}</IconTile>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-xl font-semibold leading-tight text-fg">{title}</h1>
            {badge}
          </div>
          {meta && <div className="truncate text-[13px] text-fg-muted">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
