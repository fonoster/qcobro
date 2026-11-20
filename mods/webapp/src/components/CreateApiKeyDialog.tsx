import { useState } from "react";
import { Calendar, Info } from "lucide-react";
import type { CreateApiKeyInput } from "@qcobro/common";
import { useI18n } from "../lib/i18n.js";
import { Dialog } from "./ui/dialog.js";
import { SelectGroup } from "./ui/select.js";

export interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateApiKeyInput) => void | Promise<void>;
  isPending?: boolean;
  error?: string;
}

/** Expiration presets, in days; "" means the key never expires. */
type Expiry = "" | "30" | "90" | "365";

/**
 * Create-key dialog. Every key is admin-scoped, so there is nothing to choose beyond an
 * optional expiration (a preset: none, 30 or 90 days, one year) — the dialog otherwise just
 * confirms creation.
 */
export function CreateApiKeyDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  error
}: CreateApiKeyDialogProps) {
  const { t } = useI18n();
  const [expiry, setExpiry] = useState<Expiry>("");

  function handleClose() {
    setExpiry("");
    onClose();
  }

  async function handleSubmit() {
    const expiresAt = expiry ? Date.now() + Number(expiry) * 86_400_000 : undefined;
    await onSubmit({ role: "WORKSPACE_ADMIN", expiresAt });
    setExpiry("");
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      width={480}
      title={t("apiKeys.create.title")}
      subtitle={t("apiKeys.create.description")}
      confirmLabel={t("apiKeys.create.submit")}
      confirmDisabled={isPending}
      onSubmit={handleSubmit}
      error={error}
    >
      <div className="flex gap-2.5 rounded-control bg-elevated px-3 py-2.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted" />
        <p className="text-xs text-fg-muted">{t("apiKeys.create.roleNote")}</p>
      </div>
      <SelectGroup
        label={t("apiKeys.create.expiresAtLabel")}
        id="create-api-key-expires-at"
        icon={<Calendar />}
        value={expiry}
        onChange={(e) => setExpiry(e.target.value as Expiry)}
      >
        <option value="">{t("apiKeys.create.expiry.none")}</option>
        <option value="30">{t("apiKeys.create.expiry.30")}</option>
        <option value="90">{t("apiKeys.create.expiry.90")}</option>
        <option value="365">{t("apiKeys.create.expiry.365")}</option>
      </SelectGroup>
    </Dialog>
  );
}
