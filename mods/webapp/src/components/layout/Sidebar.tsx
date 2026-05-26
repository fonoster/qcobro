import { NavLink } from "react-router-dom";
import { LayoutDashboard, FolderOpen, Megaphone, Bot, ClipboardList, HandCoins, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils.js";

const navItems = [
  { to: "/panel", label: "Panel", icon: LayoutDashboard },
  { to: "/carteras", label: "Carteras", icon: FolderOpen },
  { to: "/campanas", label: "Campañas", icon: Megaphone },
  { to: "/agentes", label: "Agentes IA", icon: Bot },
  { to: "/gestiones", label: "Gestiones", icon: ClipboardList },
  { to: "/promesas", label: "Promesas de Pago", icon: HandCoins },
  { to: "/rendimiento", label: "Rendimiento", icon: BarChart3 }
];

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r bg-white">
      <div className="flex h-14 items-center px-4 font-bold text-emerald-600 text-lg">
        QCobro
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
