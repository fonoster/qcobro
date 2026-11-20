import { Link, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Logo } from "./Logo.js";
import { AccountMenu } from "./AccountMenu.js";
import { AnnouncementBanner } from "./AnnouncementBanner.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { usePreferenceSync } from "../lib/preferenceSync.js";

/** Account-level shell for pages that do not require an active workspace (the workspaces
 * hub and the profile page). Renders under RequireAuth but outside AuthedLayout, so a
 * user with no workspace can still reach their account and log out. `padded` gives the outlet
 * the console's page padding (the profile page). */
export function AccountLayout({ padded = false }: { padded?: boolean }) {
  usePreferenceSync();
  const { logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <AnnouncementBanner />
      <header className="flex h-[72px] shrink-0 items-center justify-between gap-4 px-4 sm:px-10">
        <Link to="/workspaces" aria-label={t("nav.toWorkspaces")}>
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <AccountMenu />
          <span className="h-6 w-px bg-border" aria-hidden="true" />
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex items-center gap-1.5 rounded-control px-2 py-1.5 text-[13px] text-fg-muted transition hover:text-fg"
          >
            <LogOut aria-hidden className="h-3.5 w-3.5" />
            {t("userMenu.logout")}
          </button>
        </div>
      </header>
      <main className="flex flex-1 flex-col overflow-y-auto bg-cover bg-center dark:bg-[url(/pattern-center.png)]">
        {padded ? (
          <div className="p-8">
            <Outlet />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
