import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Folder,
  Megaphone,
  Bot,
  PhoneCall,
  HandCoins,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon
} from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n, type MessageId } from "../lib/i18n.js";
import { usePreferenceSync } from "../lib/preferenceSync.js";
import { Logo } from "./Logo.js";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher.js";
import { UserMenu } from "./UserMenu.js";
import { AnnouncementBanner } from "./AnnouncementBanner.js";
import { cn } from "@/lib/utils.js";

const NAV: { icon: LucideIcon; labelKey: MessageId; to?: string; end?: boolean }[] = [
  { icon: LayoutDashboard, labelKey: "nav.panel", to: "/", end: true },
  { icon: Folder, labelKey: "nav.portfolios", to: "/portfolios" },
  { icon: Bot, labelKey: "nav.agents", to: "/agent-templates" },
  { icon: Megaphone, labelKey: "nav.campaigns", to: "/campaigns" },
  { icon: PhoneCall, labelKey: "nav.gestiones", to: "/gestiones" },
  { icon: HandCoins, labelKey: "nav.paymentPromises", to: "/payment-promises" }
];

const SIDEBAR_COLLAPSED_KEY = "qcobro.sidebar.collapsed";

function readStoredSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function AuthedLayout() {
  const { t } = useI18n();
  const { workspace, setWorkspace, logout } = useAuth();
  const workspaces = trpc.workspaces.list.useQuery();
  const data = workspaces.data;
  const items = data?.items ?? [];
  const [collapsed, setCollapsed] = useState(readStoredSidebarCollapsed);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Non-fatal: the toggle still works for the rest of the session.
      }
      return next;
    });
  }

  // The profile is the source of truth for language + appearance; reconcile the
  // cached/default choices with it once it loads (and whenever it changes elsewhere).
  usePreferenceSync();

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
      <div className="flex min-h-screen items-center justify-center text-fg-subtle">Cargando…</div>
    );
  }
  if (!workspaces.isFetching && workspaces.isSuccess && items.length === 0) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <div className="flex h-screen flex-col bg-bg">
      <AnnouncementBanner />
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn(
            "flex shrink-0 flex-col justify-between overflow-y-auto overflow-x-hidden border-r border-border bg-surface py-5 transition-[width] duration-200 ease-in-out",
            collapsed ? "w-16 px-2" : "w-60 px-4"
          )}
        >
          <div className={cn("flex flex-col", collapsed ? "items-center gap-2" : "gap-6")}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label={t("nav.expand")}
                  title={t("nav.expand")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-elevated"
                >
                  <PanelLeftOpen className="h-[18px] w-[18px]" />
                </button>
                <Link to="/workspaces" aria-label="Ir a la lista de espacios">
                  <Logo collapsed />
                </Link>
                <WorkspaceSwitcher collapsed />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Link to="/workspaces" aria-label="Ir a la lista de espacios">
                    <Logo />
                  </Link>
                  <button
                    type="button"
                    onClick={toggleCollapsed}
                    aria-label={t("nav.collapse")}
                    title={t("nav.collapse")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-elevated"
                  >
                    <PanelLeftClose className="h-[18px] w-[18px]" />
                  </button>
                </div>
                <WorkspaceSwitcher />
              </>
            )}

            <nav className={cn("flex flex-col gap-1", collapsed && "items-center")}>
              {NAV.map(({ icon: Icon, labelKey, to, end }) =>
                to ? (
                  <NavLink
                    key={labelKey}
                    to={to}
                    end={end}
                    title={collapsed ? t(labelKey) : undefined}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center rounded-lg text-sm",
                        collapsed ? "h-10 w-10 justify-center" : "gap-3 px-3 py-2.5",
                        isActive
                          ? "bg-primary/10 font-semibold text-primary"
                          : "font-medium text-fg-muted hover:bg-elevated"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            isActive ? "text-primary" : "text-fg-subtle"
                          )}
                        />
                        <span className={cn(collapsed && "sr-only")}>{t(labelKey)}</span>
                      </>
                    )}
                  </NavLink>
                ) : (
                  <button
                    key={labelKey}
                    title={collapsed ? t(labelKey) : undefined}
                    className={cn(
                      "flex items-center rounded-lg text-sm font-medium text-fg-muted opacity-50 cursor-not-allowed",
                      collapsed ? "h-10 w-10 justify-center" : "gap-3 px-3 py-2.5"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 text-fg-subtle" />
                    <span className={cn(collapsed && "sr-only")}>{t(labelKey)}</span>
                  </button>
                )
              )}
            </nav>
          </div>

          <UserMenu collapsed={collapsed} />
        </aside>

        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
