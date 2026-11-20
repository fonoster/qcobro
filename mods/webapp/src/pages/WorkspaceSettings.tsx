import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { activeRole } from "../lib/workspaceRole.js";
import { PageHeader } from "../components/page-header.js";
import { Panel } from "../components/panel.js";
import { Button } from "../components/ui/button.js";
import { Dialog } from "../components/ui/dialog.js";
import { InputGroup } from "../components/ui/input.js";
import { SelectGroup } from "../components/ui/select.js";
import { TIMEZONES } from "../lib/timezones.js";

const CONFIRM_WORD = "ELIMINAR";

export function WorkspaceSettings() {
  const { workspace, accessToken, setWorkspace } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const workspaces = trpc.workspaces.list.useQuery();
  const update = trpc.workspaces.update.useMutation();
  const remove = trpc.workspaces.delete.useMutation();

  // Per-workspace preferences (currency + timezone).
  const settings = trpc.workspaceSettings.get.useQuery();
  const saveSettings = trpc.workspaceSettings.update.useMutation();
  const [prefDraft, setPrefDraft] = useState<{ currency: "USD" | "DOP"; timezone: string } | null>(
    null
  );
  const currency = prefDraft?.currency ?? settings.data?.currency ?? "USD";
  const timezone = prefDraft?.timezone ?? settings.data?.timezone ?? "";
  const prefDirty =
    !!settings.data &&
    (currency !== settings.data.currency || timezone.trim() !== settings.data.timezone);

  const active =
    workspaces.data?.items.find((w) => w.accessKeyId === workspace) ?? workspaces.data?.items[0];
  const isOwner = activeRole(accessToken, workspace) === "WORKSPACE_OWNER";

  // Uncontrolled-until-edited: the field shows the server name until the user
  // types, and resets to the server value after a successful save.
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<null | "ok" | "error">(null);
  const name = draft ?? active?.name ?? "";

  const dirty = !!active && name.trim().length > 0 && name.trim() !== active.name;
  const anyDirty = dirty || prefDirty;
  const saving = update.isPending || saveSettings.isPending;

  // Type-to-confirm delete dialog.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!active || !anyDirty || timezone.trim().length === 0) return;
    setStatus(null);
    try {
      if (dirty) {
        await update.mutateAsync({ ref: active.ref, name: name.trim() });
        await utils.workspaces.list.invalidate();
        setDraft(null);
      }
      if (prefDirty) {
        await saveSettings.mutateAsync({ currency, timezone: timezone.trim() });
        await utils.workspaceSettings.get.invalidate();
        setPrefDraft(null);
      }
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setConfirmText("");
    setDeleteError(false);
  }

  async function onDelete() {
    if (!active || !canDelete) return;
    setDeleteError(false);
    try {
      await remove.mutateAsync({ ref: active.ref });
      // Leave the deleted workspace; AuthedLayout re-selects another or routes
      // to workspace creation when none remain.
      setWorkspace(null);
      await utils.workspaces.list.invalidate();
      navigate("/");
    } catch {
      setDeleteError(true);
    }
  }

  function resetDrafts() {
    setDraft(null);
    setPrefDraft(null);
    setStatus(null);
  }

  const currencyLabel = (code: "USD" | "DOP") =>
    `${code} · ${t(code === "USD" ? "settings.currency.USD" : "settings.currency.DOP")}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />

      <div className="flex w-full max-w-[760px] flex-col gap-5">
        <form onSubmit={onSave}>
          <Panel title={t("settings.preferences")} aside={t("settings.preferencesAside")}>
            <InputGroup
              id="ws-name"
              label={t("settings.name")}
              required
              value={name}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectGroup
                label={t("settings.currency")}
                id="ws-currency"
                value={currency}
                onChange={(e) =>
                  setPrefDraft({ currency: e.target.value as "USD" | "DOP", timezone })
                }
              >
                <option value="DOP">{currencyLabel("DOP")}</option>
                <option value="USD">{currencyLabel("USD")}</option>
              </SelectGroup>
              <SelectGroup
                label={t("settings.timezone")}
                id="ws-timezone"
                value={timezone}
                onChange={(e) => setPrefDraft({ currency, timezone: e.target.value })}
              >
                {(TIMEZONES.includes(timezone) || !timezone
                  ? TIMEZONES
                  : [timezone, ...TIMEZONES]
                ).map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </SelectGroup>
            </div>
            <div className="flex items-center justify-end gap-2.5">
              {status === "ok" && (
                <span className="mr-auto text-[13px] text-fg-muted">{t("settings.saved")}</span>
              )}
              {status === "error" && (
                <span className="mr-auto text-[13px] text-danger">{t("settings.saveError")}</span>
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={!anyDirty || saving}
                onClick={resetDrafts}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!anyDirty || saving}>
                {t("settings.save")}
              </Button>
            </div>
          </Panel>
        </form>

        {isOwner && (
          <Panel title={t("settings.danger.title")} danger>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-sm font-medium text-fg">{t("settings.delete.title")}</h3>
                <p className="text-[13px] text-fg-muted">{t("settings.delete.desc")}</p>
              </div>
              <Button
                variant="destructive"
                className="shrink-0"
                onClick={() => setConfirmOpen(true)}
              >
                {t("settings.delete.title")}
              </Button>
            </div>
          </Panel>
        )}
      </div>

      <Dialog
        open={confirmOpen && !!active}
        onClose={closeConfirm}
        width={480}
        title={t("settings.delete.title")}
        confirmVariant="destructive"
        confirmLabel={t("settings.delete.title")}
        confirmDisabled={!canDelete || remove.isPending}
        onSubmit={onDelete}
      >
        <p className="text-[13px] text-fg-muted">
          {t("settings.delete.dialogBody").replace("{ws}", active?.name ?? "")}
        </p>
        <InputGroup
          id="ws-delete-confirm"
          label={t("settings.delete.confirmLabel")}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="[&_input]:font-mono"
          autoFocus
          error={deleteError ? t("settings.delete.error") : undefined}
        />
      </Dialog>
    </div>
  );
}
