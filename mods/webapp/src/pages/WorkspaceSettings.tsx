import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { activeRole } from "../lib/workspaceRole.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900">Configuración del espacio</h1>
        <p className="text-sm text-slate-500">{t("settings.subtitle")}</p>
      </div>

      <Card className="max-w-[680px] rounded-xl border-slate-200 shadow-none">
        <form onSubmit={onSave} className="flex flex-col gap-5 p-6">
          <h2 className="text-[15px] font-semibold text-slate-900">{t("settings.preferences")}</h2>
          <InputGroup
            label={t("settings.name")}
            required
            value={name}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("settings.name")}
          />
          <SelectGroup
            label={t("settings.currency")}
            id="ws-currency"
            value={currency}
            onChange={(e) => setPrefDraft({ currency: e.target.value as "USD" | "DOP", timezone })}
          >
            <option value="USD">USD</option>
            <option value="DOP">DOP</option>
          </SelectGroup>
          <SelectGroup
            label={t("settings.timezone")}
            id="ws-timezone"
            value={timezone}
            onChange={(e) => setPrefDraft({ currency, timezone: e.target.value })}
          >
            {(TIMEZONES.includes(timezone) || !timezone ? TIMEZONES : [timezone, ...TIMEZONES]).map(
              (tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              )
            )}
          </SelectGroup>
          <div className="flex items-center justify-end gap-3">
            {status === "ok" && (
              <span className="text-[13px] text-emerald-600">{t("settings.saved")}</span>
            )}
            {status === "error" && (
              <span className="text-[13px] text-red-600">{t("settings.saveError")}</span>
            )}
            <Button type="submit" disabled={!anyDirty || saving}>
              {t("settings.save")}
            </Button>
          </div>
        </form>
      </Card>

      {isOwner && (
        <Card className="max-w-[680px] rounded-xl border-red-200 shadow-none">
          <div className="flex items-center justify-between gap-6 p-6">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Eliminar espacio</h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                Esta acción es permanente. Se eliminarán el espacio y todos sus datos.
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => setConfirmOpen(true)}
            >
              Eliminar espacio
            </Button>
          </div>
        </Card>
      )}

      {confirmOpen && active && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
          <Card className="w-full max-w-[440px] rounded-2xl border-slate-200 shadow-xl">
            <div className="flex flex-col gap-5 p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Eliminar espacio</h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  Esta acción es permanente. Se eliminarán <strong>{active.name}</strong> y todos
                  sus datos.
                </p>
              </div>
              <InputGroup
                label={`Escribe ${CONFIRM_WORD} para confirmar`}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoFocus
                error={deleteError ? "No se pudo eliminar el espacio." : undefined}
              />
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeConfirm}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={!canDelete || remove.isPending}
                  onClick={onDelete}
                >
                  Eliminar espacio
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
