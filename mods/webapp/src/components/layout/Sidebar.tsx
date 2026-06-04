import { NavLink, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { t } from "@/lib/i18n.js";

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-sharp text-[24px] leading-none", className)}>
      {name}
    </span>
  );
}

const navItems = [
  { to: "/dashboard", label: t.nav.dashboard, icon: "dashboard" },
  { to: "/portfolios", label: t.nav.portfolios, icon: "account_balance" },
  { to: "/campaigns", label: t.nav.campaigns, icon: "cell_tower" },
  { to: "/agents", label: t.nav.agents, icon: "smart_toy" },
  { to: "/activities", label: t.nav.activities, icon: "support_agent" },
  { to: "/commitments", label: t.nav.commitments, icon: "handshake" },
  { to: "/performance", label: t.nav.performance, icon: "bar_chart" }
];

export function Sidebar() {
  const navigate = useNavigate();

  function signOut() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  const user = JSON.parse(localStorage.getItem("user") ?? "{}");

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-[88px] items-center px-8 py-6 border-b border-slate-200">
        <span className="font-extrabold text-[#047857] text-2xl leading-none">
          QCobro
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0 px-4 pt-3 pb-0">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-4 rounded-full px-4 py-3 text-base font-normal transition-colors",
                isActive
                  ? "bg-[#F0FDF4] text-[#064E3B]"
                  : "text-slate-700 hover:bg-slate-50"
              )
            }
          >
            {({ isActive }) => (
              <>
                <MaterialIcon
                  name={icon}
                  className={isActive ? "text-[#064E3B]" : "text-slate-700"}
                />
                <span className="leading-6">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2 px-8 py-6">
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <span className="text-base font-normal text-[#064E3B] leading-6 truncate">
            {user.name ?? "Admin Usuario"}
          </span>
          <span className="text-base font-normal text-slate-700 leading-6 truncate">
            {user.email ?? "admin@qcobro.com"}
          </span>
        </div>
        <button onClick={signOut} className="shrink-0 text-slate-700 hover:text-slate-900">
          <ChevronDown className="h-6 w-6" />
        </button>
      </div>
    </aside>
  );
}
