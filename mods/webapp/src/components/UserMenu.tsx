import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { User, SlidersHorizontal, Users, KeyRound, Plug, LogOut, CreditCard } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { isWorkspaceAdmin } from "../lib/workspaceRole.js";
import { MenuPanel, MenuHeader, MenuDivider, MenuItem } from "./menu.js";

export function UserMenu() {
  const { currentUser, logout, accessToken, workspace } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const canManageKeys = isWorkspaceAdmin(accessToken, workspace);
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

  const popup = open
    ? createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <MenuPanel
            className="fixed z-50 w-[244px]"
            style={{ bottom: popupPos.bottom, left: popupPos.left }}
          >
            <MenuHeader initials={initials} name={name} email={email} />
            <MenuDivider />
            <MenuItem icon={User} label={t("profile.title")} onClick={() => go("/profile")} />
            <MenuItem
              icon={SlidersHorizontal}
              label={t("settings.title")}
              onClick={() => go("/settings")}
            />
            <MenuItem icon={CreditCard} label={t("billing.title")} onClick={() => go("/billing")} />
            <MenuItem icon={Users} label={t("userMenu.members")} onClick={() => go("/members")} />
            {canManageKeys && (
              <MenuItem icon={KeyRound} label={t("nav.apiKeys")} onClick={() => go("/api-keys")} />
            )}
            {canManageKeys && (
              <MenuItem
                icon={Plug}
                label={t("userMenu.integrations")}
                onClick={() => go("/integrations")}
              />
            )}
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
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
          {initials}
        </span>
        <div className="flex min-w-0 flex-col leading-tight text-left">
          <span className="truncate text-[13px] font-semibold text-slate-900">{name}</span>
          <span className="truncate text-[11px] text-slate-400">{email || "Cuenta"}</span>
        </div>
      </button>
    </div>
  );
}
