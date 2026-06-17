import { useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { User, SlidersHorizontal, Users, LogOut } from "lucide-react";
import { useAuth } from "../lib/auth.js";
import { cn } from "@/lib/utils.js";

function MenuItem({
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

export function UserMenu() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  const initials = currentUser?.initials ?? "QC";
  const name = currentUser?.name ?? "Usuario";
  const email = currentUser?.email ?? "";

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-[244px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              {initials}
            </span>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[13px] font-semibold text-slate-900">{name}</span>
              {email && <span className="truncate text-[11px] text-slate-400">{email}</span>}
            </div>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <MenuItem icon={User} label="Mi perfil" onClick={() => go("/profile")} />
          <MenuItem
            icon={SlidersHorizontal}
            label="Configuración del espacio"
            onClick={() => go("/settings")}
          />
          <MenuItem icon={Users} label="Miembros" onClick={() => go("/members")} />
          <div className="my-1 h-px bg-slate-100" />
          <MenuItem
            icon={LogOut}
            label="Cerrar sesión"
            danger
            onClick={() => {
              setOpen(false);
              logout();
              navigate("/login");
            }}
          />
        </div>
      )}

      <button
        type="button"
        aria-label="Menú de usuario"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
          {initials}
        </span>
        <div className="flex min-w-0 flex-col leading-tight text-left">
          <span className="truncate text-[13px] font-semibold text-slate-900">{name}</span>
          <span className="truncate text-[11px] text-slate-400">{email || "Cuenta"}</span>
        </div>
      </button>
    </div>
  );
}
