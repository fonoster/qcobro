import { useState } from "react";
import { useI18n } from "../../lib/i18n.js";
import { Dialog } from "./dialog.js";
import { Input } from "./input.js";
import { FieldLabel } from "./field.js";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isPending?: boolean;
}

/** A typed delete: the operator writes CONFIRMAR to enable the destructive action. */
export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  isPending
}: ConfirmDeleteDialogProps) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const confirmed = value === "CONFIRMAR";

  function handleClose() {
    setValue("");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      width={480}
      title={title}
      subtitle={description}
      confirmVariant="destructive"
      confirmDisabled={!confirmed || isPending}
      confirmLabel={isPending ? t("confirmDialog.deleting") : t("confirmDialog.delete")}
      onSubmit={() => confirmed && onConfirm()}
    >
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="confirm-delete-input">
          {t("confirmDialog.labelPre")}
          <span className="font-mono font-semibold">CONFIRMAR</span>
          {t("confirmDialog.labelPost")}
        </FieldLabel>
        <Input
          id="confirm-delete-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="CONFIRMAR"
          className="font-mono"
          autoFocus
        />
      </div>
    </Dialog>
  );
}
