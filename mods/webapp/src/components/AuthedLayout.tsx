import { useEffect } from "react";
import { Link, Navigate, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Folder,
  Megaphone,
  Bot,
  PhoneCall,
  Handshake,
  TrendingUp,
  type LucideIcon
} from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n, type MessageId } from "../lib/i18n.js";
import { Logo } from "./Logo.js";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher.js";
import { UserMenu } from "./UserMenu.js";
import { cn } from "@/lib/utils.js";

const NAV: { icon: LucideIcon; labelKey: MessageId; to?: string; end?: boolean }[] = [
  { icon: LayoutDashboard, labelKey: "nav.panel", to: "/", end: true },
  { icon: Folder, labelKey: "nav.portfolios", to: "/portfolios" },
  { icon: Megaphone, labelKey: "nav.campaigns", to: "/campaigns" },
  { icon: Bot, labelKey: "nav.agents", to: "/agent-templates" },
  { icon: PhoneCall, labelKey: "nav.gestiones", to: "/gestiones" },
  { icon: Handshake, labelKey: "nav.objetivos" },
  { icon: TrendingUp, labelKey: "nav.performance" }
];

export function AuthedLayout() {
  const { t } = useI18n();
  const { workspace, setWorkspace, logout } = useAuth();
  const workspaces = trpc.workspaces.list.useQuery();
  const data = workspaces.data;
  const items = data?.items ?? [];

  useEffect(() => {
    const list = data?.items;
    if (!list || list.length === 0) return;
    if (!list.some((w) => w.accessKeyId === workspace)) {
      setWorkspace(list[0].accessKeyId);
    }
  }, [data, workspace, setWorkspace]);

  useEffect(() => {
    if (workspaces.isError) logout();
  }, [workspaces.isError, logout]);

  if (workspaces.isError) {
    return <Navigate to="/login" replace />;
  }
  if (workspaces.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">Cargando…</div>
    );
  }
  if (!workspaces.isFetching && workspaces.isSuccess && items.length === 0) {
    return <Navigate to="/create-workspace" replace />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col justify-between border-r border-slate-200 bg-white px-4 py-5">
        <div className="flex flex-col gap-6">
          <Link to="/create-workspace" aria-label="Ir a la lista de espacios">
            <Logo />
          </Link>
          <WorkspaceSwitcher />
          <nav className="flex flex-col gap-1">
            {NAV.map(({ icon: Icon, labelKey, to, end }) =>
              to ? (
                <NavLink
                  key={labelKey}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                      isActive
                        ? "bg-emerald-50 font-semibold text-emerald-700"
                        : "font-medium text-slate-600 hover:bg-slate-50"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px]",
                          isActive ? "text-emerald-700" : "text-slate-500"
                        )}
                      />
                      {t(labelKey)}
                    </>
                  )}
                </NavLink>
              ) : (
                <button
                  key={labelKey}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 opacity-50 cursor-not-allowed"
                >
                  <Icon className="h-[18px] w-[18px] text-slate-500" />
                  {t(labelKey)}
                </button>
              )
            )}
          </nav>
        </div>

        <UserMenu />
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
