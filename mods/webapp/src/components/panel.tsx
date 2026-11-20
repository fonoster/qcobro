import type { ReactNode } from "react";
import { cn } from "@/lib/utils.js";

export interface PanelProps {
  title: ReactNode;
  /** The header's right end: muted 12 text, or any node (a status, a link). */
  aside?: ReactNode;
  /** Draw the danger stroke (Zona de peligro). */
  danger?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * A bordered settings panel: a header row (title 14/500, muted aside on the right) and its
 * body, padding 20, gap 16. Used by the Administración pages (Facturación, Integraciones,
 * Configuración).
 *
 * @example <Panel title="Preferencias" aside="Un espacio agrupa tus carteras…">…fields…</Panel>
 */
export function Panel({ title, aside, danger, className, children }: PanelProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-card border bg-surface p-5",
        danger ? "border-danger" : "border-border",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {aside != null &&
          (typeof aside === "string" ? (
            <span className="text-right text-xs text-fg-muted">{aside}</span>
          ) : (
            aside
          ))}
      </div>
      {children}
    </section>
  );
}
