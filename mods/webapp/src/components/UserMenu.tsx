import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { User, LogOut } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n, type MessageId } from "../lib/i18n.js";
import { activeRole } from "../lib/workspaceRole.js";
import { MenuPanel, MenuHeader, MenuDivider, MenuItem } from "./menu.js";
import { LanguageMenuItem } from "./LanguageMenuItem.js";
import { cn } from "@/lib/utils.js";

/** The sidebar footer: the user's name and workspace role. It opens the user menu (Mi perfil,
 * Idioma, Cerrar sesión); workspace pages live in the sidebar itself. Collapsed, only the
 * initials avatar shows. */
export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { currentUser, logout, accessToken, workspace } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popupPos, setPopupPos] = useState({ bottom: 0, left: 0 });

  useEffect(() => {
    if (open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setPopupPos({ bottom: window.innerHeight - r.top + 8, left: r.left });
    }
  }, [open]);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  // The id token carries no `name` claim, so currentUser.name falls back to the email.
  // Prefer the real name from the identity profile for the display label.
  const profile = trpc.profile.get.useQuery();
  const initials = currentUser?.initials ?? "QC";
  const email = currentUser?.email ?? "";
  const name = profile.data?.name?.trim() || currentUser?.name || t("userMenu.fallbackName");
  const role = activeRole(accessToken, workspace);
  const roleLabel = role ? t(`members.role.${role}` as MessageId) : "";

  const popup = open
    ? createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <MenuPanel
            label={t("userMenu.aria")}
            className="fixed z-50 w-[244px]"
            style={{ bottom: popupPos.bottom, left: popupPos.left }}
          >
            <MenuHeader initials={initials} name={name} email={email} />
            <MenuDivider />
            <MenuItem icon={User} label={t("profile.title")} onClick={() => go("/profile")} />
            <LanguageMenuItem onPicked={() => setOpen(false)} />
            <MenuDivider />
            <MenuItem
              icon={LogOut}
              label={t("userMenu.logout")}
              danger
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
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2.5 rounded-[var(--radius-control)] hover:bg-sidebar-accent",
          collapsed ? "justify-center p-1.5" : "w-full px-2 py-2"
        )}
      >
        {collapsed ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-fg">
            {initials}
          </span>
        ) : (
          <div className="flex min-w-0 flex-col text-left leading-tight">
            <span className="truncate text-sm font-medium text-fg">{name}</span>
            {roleLabel && <span className="truncate text-xs text-fg-subtle">{roleLabel}</span>}
          </div>
        )}
      </button>
    </div>
  );
}
