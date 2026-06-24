import { type FormEvent } from "react";
import { X } from "lucide-react";
import type { CreateApiKeyInput } from "@qcobro/common";
import { useI18n } from "../lib/i18n.js";
import { Card } from "./ui/card.js";
import { Button } from "./ui/button.js";

export interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateApiKeyInput) => void | Promise<void>;
  isPending?: boolean;
  error?: string;
}

/**
 * Create-key dialog. Every key is admin-scoped, so there is nothing to choose —
 * the dialog confirms creation. Expiry is intentionally omitted: Identity's
 * gRPC contract types the timestamp as int32, which can't represent an epoch-ms
 * Date, so an expiry can't be set correctly until that's widened upstream.
 */
export function CreateApiKeyDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  error
}: CreateApiKeyDialogProps) {
  const { t } = useI18n();

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({ role: "WORKSPACE_ADMIN" });
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
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-[13px] text-slate-500">{t("apiKeys.create.roleNote")}</p>
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
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
