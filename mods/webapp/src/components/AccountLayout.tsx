import { Link, Outlet } from "react-router-dom";
import { Logo } from "./Logo.js";
import { AccountMenu } from "./AccountMenu.js";
import { AnnouncementBanner } from "./AnnouncementBanner.js";

/** Account-level shell for pages that do not require an active workspace (the workspaces
 * hub and the profile page). Renders under RequireAuth but outside AuthedLayout, so a
 * user with no workspace can still reach their account and log out. */
export function AccountLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AnnouncementBanner />
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-10">
        <Link to="/workspaces" aria-label="Ir a la lista de espacios">
          <Logo />
        </Link>
        <AccountMenu />
      </header>
      <main className="flex flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
