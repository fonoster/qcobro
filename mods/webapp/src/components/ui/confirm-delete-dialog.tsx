import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { X } from "lucide-react";
import { Button } from "./button.js";
import { useI18n } from "../../lib/i18n.js";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isPending?: boolean;
}

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

  if (!open) return null;

  const confirmed = value === "CONFIRMAR";

  function handleConfirm() {
    if (!confirmed) return;
    onConfirm();
  }

  function handleClose() {
    setValue("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>

        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">
            {t("confirmDialog.labelPre")}
            <span className="font-mono font-bold text-slate-900">CONFIRMAR</span>
            {t("confirmDialog.labelPost")}
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            placeholder="CONFIRMAR"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            autoFocus
          />
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="destructive" onClick={handleConfirm} disabled={!confirmed || isPending}>
            {isPending ? t("confirmDialog.deleting") : t("confirmDialog.delete")}
          </Button>
          <Button variant="outline" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
