import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { User, LogOut } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { MenuPanel, MenuDivider, MenuItem } from "./menu.js";
import { LanguageMenuItem } from "./LanguageMenuItem.js";

/** Account menu for account-level pages (the workspaces hub and profile). Opens from the
 * top bar's initials, name and email, and drops downward. Unlike the in-app UserMenu it omits
 * workspace-scoped entries (no active workspace here) and offers a language switcher. */
export function AccountMenu() {
  const { currentUser, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
  }, [open]);

  // The id token carries no `name` claim, so prefer the identity profile for the label.
  const profile = trpc.profile.get.useQuery();
  const initials = currentUser?.initials ?? "QC";
  const email = currentUser?.email ?? "";
  const name = profile.data?.name?.trim() || currentUser?.name || t("userMenu.fallbackName");

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  const popup = open
    ? createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <MenuPanel
            label={t("userMenu.aria")}
            className="fixed z-50 w-[240px]"
            style={{ top: pos.top, right: pos.right }}
          >
            <MenuItem icon={User} label={t("profile.title")} onClick={() => go("/profile")} />
            <LanguageMenuItem />
            <MenuDivider />
            <MenuItem
              icon={LogOut}
              label={t("userMenu.logout")}
              onClick={() => {
                setOpen(false);
                logout();
                navigate("/login");
              }}
            />
          </MenuPanel>
        </>,
        document.body
      )
    : null;

  return (
    <div className="relative">
      {popup}

      <button
        ref={buttonRef}
        type="button"
        aria-label={t("userMenu.aria")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition hover:bg-elevated"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-elevated font-mono text-xs text-fg">
          {initials}
        </span>
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="truncate text-[13px] font-semibold text-fg">{name}</span>
          {email && <span className="truncate text-[11px] text-fg-subtle">{email}</span>}
        </span>
      </button>
    </div>
  );
}
