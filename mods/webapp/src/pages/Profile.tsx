import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n, languages, languageNames, type Language } from "../lib/i18n.js";
import { useTheme, themes, type ThemePreference } from "../lib/theme.js";
import { PageHeader } from "../components/page-header.js";
import { cn } from "@/lib/utils.js";
import { Button } from "../components/ui/button.js";
import { Dialog } from "../components/ui/dialog.js";
import { InputGroup } from "../components/ui/input.js";
import { SelectGroup } from "../components/ui/select.js";

const CONFIRM_WORD = "ELIMINAR";

/** A bordered panel: card fill, padding 20, gap 16, title 14/500. */
const panelClass = "flex flex-col gap-4 rounded-card border border-border bg-surface p-5";
const panelTitleClass = "text-sm font-medium text-fg";

export function Profile() {
  const { logout } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const { preference: theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const profile = trpc.profile.get.useQuery();
  const update = trpc.profile.update.useMutation();
  const setLang = trpc.profile.setLanguage.useMutation();
  const setThemeMut = trpc.profile.setTheme.useMutation();
  const changePassword = trpc.profile.changePassword.useMutation();
  const remove = trpc.profile.delete.useMutation();

  const serverName = profile.data?.name ?? "";
  const serverPhone = profile.data?.phone ?? "";
  const email = profile.data?.email ?? "";

  // Uncontrolled-until-edited: fields show server values until the user types.
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [status, setStatus] = useState<null | "ok" | "error">(null);
  const nameValue = name ?? serverName;
  const phoneValue = phone ?? serverPhone;

  const dirty =
    !!profile.data &&
    nameValue.trim().length > 0 &&
    (nameValue.trim() !== serverName || phoneValue.trim() !== serverPhone);

  // Change password.
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<null | "ok" | "error">(null);

  async function onChangePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordStatus(null);
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.password.mismatch"));
      return;
    }
    try {
      await changePassword.mutateAsync({ password: newPassword });
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("ok");
    } catch {
      setPasswordStatus("error");
    }
  }

  // Type-to-confirm account deletion.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    setStatus(null);
    try {
      await update.mutateAsync({ name: nameValue.trim(), phone: phoneValue.trim() || undefined });
      await profile.refetch();
      setName(null);
      setPhone(null);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  // Language applies immediately (UI + cache), and we keep the profile query in sync so the
  // server-reconcile effect (AuthedLayout) doesn't revert the optimistic change before the
  // mutation lands. Persist to the profile (source of truth), then refetch to confirm.
  function onLanguageChange(next: Language) {
    setLanguage(next);
    utils.profile.get.setData(undefined, (prev) => (prev ? { ...prev, language: next } : prev));
    setLang.mutate({ language: next }, { onSettled: () => utils.profile.get.invalidate() });
  }

  // Appearance applies immediately (ThemeProvider + cache) and persists to the profile,
  // which is the source of truth; the reconcile effect in AuthedLayout keeps them in sync.
  function onAppearanceChange(next: ThemePreference) {
    setTheme(next);
    utils.profile.get.setData(undefined, (prev) => (prev ? { ...prev, theme: next } : prev));
    setThemeMut.mutate({ theme: next }, { onSettled: () => utils.profile.get.invalidate() });
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setConfirmText("");
    setDeleteError(false);
  }

  async function onDelete() {
    if (!canDelete) return;
    setDeleteError(false);
    try {
      await remove.mutateAsync();
      // The account is gone; drop the session and return to login.
      logout();
      navigate("/login");
    } catch {
      setDeleteError(true);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("profile.title")} description={t("profile.subtitle")} />

      <div className="flex w-full max-w-[720px] flex-col gap-5">
        <form onSubmit={onSubmit} className={panelClass}>
          <h2 className={panelTitleClass}>{t("profile.section.general")}</h2>
          <InputGroup
            id="profile-name"
            label={t("profile.field.name")}
            required
            value={nameValue}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("profile.field.namePlaceholder")}
          />
          <InputGroup
            id="profile-email"
            label={t("profile.field.email")}
            value={email}
            readOnly
            disabled
          />
          <InputGroup
            id="profile-phone"
            label={t("profile.field.phone")}
            value={phoneValue}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("profile.field.phonePlaceholder")}
            className="[&_input]:font-mono"
          />
          <SelectGroup
            id="profile-language"
            label={t("profile.field.language")}
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as Language)}
          >
            {languages.map((lng) => (
              <option key={lng} value={lng}>
                {languageNames[lng]}
              </option>
            ))}
          </SelectGroup>
          <SelectGroup
            id="profile-appearance"
            label={t("profile.field.appearance")}
            value={theme}
            onChange={(e) => onAppearanceChange(e.target.value as ThemePreference)}
          >
            {themes.map((opt) => (
              <option key={opt} value={opt}>
                {t(`profile.appearance.${opt}` as const)}
              </option>
            ))}
          </SelectGroup>
          <div className="flex items-center justify-end gap-3">
            {status === "ok" && (
              <span className="text-[13px] text-primary">{t("profile.saved")}</span>
            )}
            {status === "error" && (
              <span className="text-[13px] text-danger">{t("profile.saveError")}</span>
            )}
            <Button type="submit" disabled={!dirty || update.isPending}>
              {t("profile.save")}
            </Button>
          </div>
        </form>

        <form onSubmit={onChangePassword} className={panelClass}>
          <h2 className={panelTitleClass}>{t("profile.password.title")}</h2>
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            <InputGroup
              id="profile-new-password"
              label={t("profile.password.newPassword")}
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
            <InputGroup
              id="profile-confirm-password"
              label={t("profile.password.confirmPassword")}
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              error={passwordError ?? undefined}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            {passwordStatus === "ok" && (
              <span className="text-[13px] text-primary">{t("profile.password.saved")}</span>
            )}
            {passwordStatus === "error" && (
              <span className="text-[13px] text-danger">{t("profile.password.saveError")}</span>
            )}
            <Button
              type="submit"
              variant="outline"
              disabled={changePassword.isPending || !newPassword || !confirmPassword}
            >
              {changePassword.isPending ? t("profile.password.saving") : t("profile.password.save")}
            </Button>
          </div>
        </form>

        <section className={cn(panelClass, "border-danger")}>
          <h2 className={panelTitleClass}>{t("profile.danger.title")}</h2>
          <div className="flex items-center justify-between gap-4">
            <p className="text-[13px] leading-normal text-fg-muted">{t("profile.danger.desc")}</p>
            <Button variant="destructive" className="shrink-0" onClick={() => setConfirmOpen(true)}>
              {t("profile.danger.action")}
            </Button>
          </div>
        </section>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={closeConfirm}
        width={480}
        title={t("profile.danger.title")}
        subtitle={t("profile.danger.desc")}
        confirmVariant="destructive"
        confirmLabel={t("profile.danger.action")}
        confirmDisabled={!canDelete || remove.isPending}
        onSubmit={onDelete}
      >
        <InputGroup
          label={t("profile.delete.confirmLabel")}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="[&_input]:font-mono"
          autoFocus
          error={deleteError ? t("profile.delete.error") : undefined}
        />
      </Dialog>
    </div>
  );
}
