import { Fragment, useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  FolderOpen,
  Megaphone,
  Bot,
  PhoneCall,
  Handshake,
  Puzzle,
  Users,
  KeyRound,
  Receipt,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon
} from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n, type MessageId } from "../lib/i18n.js";
import { usePreferenceSync } from "../lib/preferenceSync.js";
import { isWorkspaceAdmin } from "../lib/workspaceRole.js";
import { Logo } from "./Logo.js";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher.js";
import { UserMenu } from "./UserMenu.js";
import { AnnouncementBanner } from "./AnnouncementBanner.js";
import { cn } from "@/lib/utils.js";

interface NavItem {
  icon: LucideIcon;
  labelKey: MessageId;
  to: string;
  end?: boolean;
  /** Shown only to workspace owners and admins. */
  adminOnly?: boolean;
}

/** The sidebar's groups, in order. The first has no label. */
const NAV: { labelKey?: MessageId; items: NavItem[] }[] = [
  {
    items: [
      { icon: LayoutDashboard, labelKey: "nav.panel", to: "/", end: true },
      { icon: FolderOpen, labelKey: "nav.portfolios", to: "/portfolios" },
      { icon: Megaphone, labelKey: "nav.campaigns", to: "/campaigns" },
      { icon: Bot, labelKey: "nav.agents", to: "/agent-templates" }
    ]
  },
  {
    labelKey: "nav.section.followUp",
    items: [
      { icon: PhoneCall, labelKey: "nav.gestiones", to: "/gestiones" },
      { icon: Handshake, labelKey: "nav.paymentPromises", to: "/payment-promises" }
    ]
  },
  {
    labelKey: "nav.section.workspace",
    items: [
      { icon: Puzzle, labelKey: "nav.integrations", to: "/integrations", adminOnly: true },
      { icon: Users, labelKey: "nav.members", to: "/members" },
      { icon: KeyRound, labelKey: "nav.apiKeys", to: "/api-keys", adminOnly: true },
      { icon: Receipt, labelKey: "nav.billing", to: "/billing" },
      { icon: Settings, labelKey: "nav.settings", to: "/settings" }
    ]
  }
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
  const { workspace, setWorkspace, logout, accessToken } = useAuth();
  const isAdmin = isWorkspaceAdmin(accessToken, workspace);
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
      <div className="flex min-h-screen items-center justify-center text-fg-subtle">
        {t("common.loading")}
      </div>
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
            "flex shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar transition-[width] duration-200 ease-in-out",
            collapsed ? "w-16" : "w-[248px]"
          )}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-2 border-b border-border px-2 pb-4 pt-5">
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={t("nav.expand")}
                title={t("nav.expand")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-fg hover:bg-sidebar-accent"
              >
                <PanelLeftOpen className="h-[18px] w-[18px]" />
              </button>
              <Link to="/workspaces" aria-label={t("nav.toWorkspaces")}>
                <Logo collapsed />
              </Link>
              <WorkspaceSwitcher collapsed />
            </div>
          ) : (
            <div className="flex flex-col gap-4 border-b border-border px-5 pb-5 pt-6">
              <div className="flex items-center justify-between">
                <Link to="/workspaces" aria-label={t("nav.toWorkspaces")}>
                  <Logo />
                </Link>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label={t("nav.collapse")}
                  title={t("nav.collapse")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-fg hover:bg-sidebar-accent"
                >
                  <PanelLeftClose className="h-[18px] w-[18px]" />
                </button>
              </div>
              <WorkspaceSwitcher />
            </div>
          )}

          <nav
            className={cn(
              "flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden py-2",
              collapsed ? "items-center px-2" : "px-3"
            )}
          >
            {NAV.map(({ labelKey: groupKey, items: groupItems }, i) => {
              const visible = groupItems.filter((item) => isAdmin || !item.adminOnly);
              const links = visible.map(({ icon: Icon, labelKey, to, end }) => (
                <NavLink
                  key={labelKey}
                  to={to}
                  end={end}
                  title={collapsed ? t(labelKey) : undefined}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center rounded-[var(--radius-control)] text-sm",
                      collapsed ? "h-10 w-10 justify-center" : "gap-3 px-3 py-[7px]",
                      isActive
                        ? "bg-sidebar-accent font-medium text-fg"
                        : "text-sidebar-fg hover:bg-sidebar-accent"
                    )
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={cn("truncate", collapsed && "sr-only")}>{t(labelKey)}</span>
                </NavLink>
              ));
              if (!groupKey) return <Fragment key={i}>{links}</Fragment>;
              return (
                <div
                  key={groupKey}
                  role="group"
                  aria-label={t(groupKey)}
                  className={cn("flex flex-col gap-0.5", collapsed && "items-center")}
                >
                  {collapsed ? (
                    <div aria-hidden className="my-2 h-px w-8 bg-border" />
                  ) : (
                    <span
                      aria-hidden
                      className="px-3 pb-1.5 pt-[18px] font-mono text-[11px] uppercase text-fg-muted"
                    >
                      {t(groupKey)}
                    </span>
                  )}
                  {links}
                </div>
              );
            })}
          </nav>

          <div className={cn(collapsed ? "px-2 py-3" : "px-3 py-3")}>
            <UserMenu collapsed={collapsed} />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
