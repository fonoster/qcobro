import { useState } from "react";
import type { CreateApiKeyInput } from "@qcobro/common";
import { useI18n } from "../lib/i18n.js";
import { Dialog } from "./ui/dialog.js";
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

  function reset() {
    setExpiresAtDate("");
    setDateError(undefined);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
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
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("apiKeys.create.title")}
      subtitle={t("apiKeys.create.description")}
      confirmLabel={t("apiKeys.create.submit")}
      confirmDisabled={isPending}
      onSubmit={handleSubmit}
      error={error}
    >
      <p className="rounded-control bg-elevated px-3 py-2.5 text-xs text-fg-muted">
        {t("apiKeys.create.roleNote")}
      </p>
      <InputGroup
        label={t("apiKeys.create.expiresAtLabel")}
        id="create-api-key-expires-at"
        type="date"
        value={expiresAtDate}
        onChange={(e) => setExpiresAtDate(e.target.value)}
        error={dateError}
      />
    </Dialog>
  );
}
