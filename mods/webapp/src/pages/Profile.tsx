import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n, languages, languageNames, type Language } from "../lib/i18n.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { InputGroup } from "../components/ui/input.js";
import { SelectGroup } from "../components/ui/select.js";

const CONFIRM_WORD = "ELIMINAR";

export function Profile() {
  const { logout } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const profile = trpc.profile.get.useQuery();
  const update = trpc.profile.update.useMutation();
  const setLang = trpc.profile.setLanguage.useMutation();
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900">{t("profile.title")}</h1>
        <p className="text-sm text-slate-500">{t("profile.subtitle")}</p>
      </div>

      <Card className="max-w-[680px] rounded-xl border-slate-200 shadow-none">
        <form onSubmit={onSubmit} className="flex flex-col gap-5 p-6">
          <h2 className="text-[15px] font-semibold text-slate-900">
            {t("profile.section.general")}
          </h2>
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
            hint={t("profile.field.emailHint")}
          />
          <InputGroup
            id="profile-phone"
            label={t("profile.field.phone")}
            value={phoneValue}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("profile.field.phonePlaceholder")}
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
          <div className="flex items-center justify-end gap-3">
            {status === "ok" && (
              <span className="text-[13px] text-emerald-600">{t("profile.saved")}</span>
            )}
            {status === "error" && (
              <span className="text-[13px] text-red-600">{t("profile.saveError")}</span>
            )}
            <Button type="submit" disabled={!dirty || update.isPending}>
              {t("profile.save")}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="max-w-[680px] rounded-xl border-red-200 shadow-none">
        <div className="flex items-center justify-between gap-6 p-6">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">
              {t("profile.danger.title")}
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">{t("profile.danger.desc")}</p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setConfirmOpen(true)}
          >
            {t("profile.danger.action")}
          </Button>
        </div>
      </Card>

      {confirmOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
          <Card className="w-full max-w-[440px] rounded-2xl border-slate-200 shadow-xl">
            <div className="flex flex-col gap-5 p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{t("profile.danger.title")}</h2>
                <p className="mt-1 text-[13px] text-slate-500">{t("profile.danger.desc")}</p>
              </div>
              <InputGroup
                label={t("profile.delete.confirmLabel")}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoFocus
                error={deleteError ? t("profile.delete.error") : undefined}
              />
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeConfirm}>
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={!canDelete || remove.isPending}
                  onClick={onDelete}
                >
                  {t("profile.danger.action")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
