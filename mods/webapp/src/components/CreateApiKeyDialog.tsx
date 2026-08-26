import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { CreateApiKeyInput } from "@qcobro/common";
import { useI18n } from "../lib/i18n.js";
import { Card } from "./ui/card.js";
import { Button } from "./ui/button.js";
import { InputGroup } from "./ui/input.js";

export interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateApiKeyInput) => void | Promise<void>;
  isPending?: boolean;
  error?: string;
}

/**
 * Create-key dialog. Every key is admin-scoped, so there is nothing to choose
 * beyond an optional expiration — the dialog otherwise just confirms creation.
 */
export function CreateApiKeyDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  error
}: CreateApiKeyDialogProps) {
  const { t } = useI18n();
  const [expiresAtDate, setExpiresAtDate] = useState("");
  const [dateError, setDateError] = useState<string | undefined>();

  if (!open) return null;

  function reset() {
    setExpiresAtDate("");
    setDateError(undefined);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setDateError(undefined);

    let expiresAt: number | undefined;
    if (expiresAtDate) {
      expiresAt = new Date(expiresAtDate).getTime();
      if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
        setDateError(t("apiKeys.create.expiresAtError"));
        return;
      }
    }

    await onSubmit({ role: "WORKSPACE_ADMIN", expiresAt });
    reset();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 p-4">
      <Card className="w-full max-w-[440px] rounded-2xl border-slate-200 shadow-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t("apiKeys.create.title")}</h2>
              <p className="text-[13px] text-slate-500">{t("apiKeys.create.description")}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-[13px] text-slate-500">{t("apiKeys.create.roleNote")}</p>
          <InputGroup
            label={t("apiKeys.create.expiresAtLabel")}
            id="create-api-key-expires-at"
            type="date"
            value={expiresAtDate}
            onChange={(e) => setExpiresAtDate(e.target.value)}
            error={dateError}
          />
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t("apiKeys.create.submit")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
