import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";

export function AuthedLayout() {
  const { t } = useI18n();
  const { workspace, setWorkspace, logout } = useAuth();
  const workspaces = trpc.workspaces.list.useQuery();

  const items = workspaces.data?.items ?? [];

  // Default the active workspace to the first one the user belongs to.
  useEffect(() => {
    if (items.length > 0 && !items.some((w) => w.accessKeyId === workspace)) {
      setWorkspace(items[0].accessKeyId);
    }
  }, [items, workspace, setWorkspace]);

  if (workspaces.isLoading) {
    return <p className="p-6 text-gray-500">{t("common.loading")}</p>;
  }

  // An authenticated user with no workspace is sent to create their first one.
  if (workspaces.isSuccess && items.length === 0) {
    return <Navigate to="/create-workspace" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold">{t("app.title")}</h1>
          <p className="text-sm text-gray-500">{t("app.tagline")}</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">{t("workspace.label")}</span>
            <select
              className="rounded border border-gray-300 px-2 py-1"
              value={workspace ?? ""}
              onChange={(e) => setWorkspace(e.target.value)}
            >
              {items.map((w) => (
                <option key={w.accessKeyId} value={w.accessKeyId}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <LanguageSwitcher />
          <button
            onClick={logout}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            {t("auth.logout")}
          </button>
        </div>
      </header>
      <main className="px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
