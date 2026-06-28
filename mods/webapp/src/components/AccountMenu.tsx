import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { User, Globe, LogOut } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n, languages, languageNames, type Language } from "../lib/i18n.js";
import { MenuPanel, MenuHeader, MenuDivider, MenuItem } from "./menu.js";

/** Account menu for account-level pages (the workspaces hub and profile). Opens from the
 * top-right avatar and drops downward. Unlike the in-app UserMenu it omits
 * workspace-scoped entries (no active workspace here) and offers a language switcher. */
export function AccountMenu() {
  const { currentUser, logout } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const setLang = trpc.profile.setLanguage.useMutation();
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

  // Persist to the profile (the source of truth) so the AuthedLayout reconcile effect does
  // not revert the choice when the user later enters a workspace. Optimistically update the
  // cache and the UI first, like the Profile page does.
  function onLanguageChange(next: Language) {
    setLanguage(next);
    utils.profile.get.setData(undefined, (prev) => (prev ? { ...prev, language: next } : prev));
    setLang.mutate({ language: next }, { onSettled: () => utils.profile.get.invalidate() });
  }

  const popup = open
    ? createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <MenuPanel className="fixed z-50 w-[260px]" style={{ top: pos.top, right: pos.right }}>
            <MenuHeader initials={initials} name={name} email={email} />
            <MenuDivider />
            <MenuItem icon={User} label={t("profile.title")} onClick={() => go("/profile")} />
            <div className="flex items-center justify-between gap-2.5 px-2.5 py-2">
              <span className="flex items-center gap-2.5 text-[13px] font-medium text-slate-900">
                <Globe className="h-4 w-4 text-slate-500" />
                {t("language.label")}
              </span>
              <select
                aria-label={t("language.label")}
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as Language)}
                className="cursor-pointer rounded-md border-none bg-transparent text-[13px] font-medium text-slate-500 focus:outline-none"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {languageNames[l]}
                  </option>
                ))}
              </select>
            </div>
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
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 transition hover:bg-slate-300"
      >
        <span className="text-[13px] font-bold text-slate-600">{initials}</span>
      </button>
    </div>
  );
}
