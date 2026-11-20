import { Link, Outlet, useNavigate } from "react-router-dom";
import { Logo } from "./Logo.js";
import { AccountMenu } from "./AccountMenu.js";
import { AnnouncementBanner } from "./AnnouncementBanner.js";
import { Button } from "./ui/button.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { usePreferenceSync } from "../lib/preferenceSync.js";

/** Account-level shell for pages that do not require an active workspace (the workspaces
 * hub and the profile page). Renders under RequireAuth but outside AuthedLayout, so a
 * user with no workspace can still reach their account and log out. */
export function AccountLayout() {
  usePreferenceSync();
  const { logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <AnnouncementBanner />
      <header className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-border px-4 sm:px-10">
        <Link to="/workspaces" aria-label="Ir a la lista de espacios">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <AccountMenu />
          <span className="h-6 w-px bg-border" aria-hidden="true" />
          <Button
            variant="outline"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            {t("userMenu.logout")}
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col overflow-y-auto bg-cover bg-center dark:bg-[url(/pattern-center.png)]">
        <Outlet />
      </main>
    </div>
  );
}
