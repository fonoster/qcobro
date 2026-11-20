import type { ComponentType, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils.js";

/** A dropdown menu surface: rounded card with border and shadow. Positioning is the
 * caller's job (pass `className`/`style` for fixed placement). Shared by the in-app
 * UserMenu (sidebar) and the account-level AccountMenu (workspaces hub). */
export function MenuPanel({
  children,
  className,
  style,
  label
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** When set, the panel is a labelled dialog (its accessible name). */
  label?: string;
}) {
  return (
    <div
      role={label ? "dialog" : undefined}
      aria-label={label}
      style={style}
      className={cn("rounded-xl border border-border bg-surface p-1.5 shadow-lg", className)}
    >
      {children}
    </div>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-border" />;
}

export function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-elevated",
        danger ? "text-danger" : "text-fg"
      )}
    >
      <Icon className={cn("h-4 w-4", danger ? "text-danger" : "text-fg-muted")} />
      {label}
    </button>
  );
}
