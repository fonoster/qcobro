import type { ComponentType, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils.js";

/** A dropdown menu surface: rounded card with border and shadow. Positioning is the
 * caller's job (pass `className`/`style` for fixed placement). Shared by the in-app
 * UserMenu (sidebar) and the account-level AccountMenu (workspaces hub). */
export function MenuPanel({
  children,
  className,
  style
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn("rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg", className)}
    >
      {children}
    </div>
  );
}

/** Account identity block shown at the top of a menu. */
export function MenuHeader({
  initials,
  name,
  email
}: {
  initials: string;
  name: string;
  email?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
        {initials}
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13px] font-semibold text-slate-900">{name}</span>
        {email && <span className="truncate text-[11px] text-slate-400">{email}</span>}
      </div>
    </div>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-slate-100" />;
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
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium hover:bg-slate-50",
        danger ? "text-red-600" : "text-slate-900"
      )}
    >
      <Icon className={cn("h-4 w-4", danger ? "text-red-600" : "text-slate-500")} />
      {label}
    </button>
  );
}
