import { KeyRound } from "lucide-react";
import { useI18n } from "../lib/i18n.js";
import { Card } from "./ui/card.js";
import { Button } from "./ui/button.js";
import { CopyField } from "./CopyField.js";

export interface ApiKeyCredentials {
  accessKeyId: string;
  accessKeySecret: string;
}

export interface ShowSecretDialogProps {
  /** The freshly created/regenerated credentials, or null when hidden. */
  credentials: ApiKeyCredentials | null;
  onClose: () => void;
}

/**
 * Presents a newly created/regenerated key's secret exactly once. The secret is
 * held only by the page that renders this and is discarded on close — there is
 * no way to retrieve it again.
 */
export function ShowSecretDialog({ credentials, onClose }: ShowSecretDialogProps) {
  const { t } = useI18n();
  if (!credentials) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
      <Card className="w-full max-w-[480px] rounded-2xl border-slate-200 shadow-xl">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <KeyRound className="h-5 w-5 text-amber-600" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t("apiKeys.secret.title")}</h2>
              <p className="mt-0.5 text-[13px] text-slate-500">{t("apiKeys.secret.description")}</p>
            </div>
          </div>
          <CopyField label={t("apiKeys.secret.idLabel")} value={credentials.accessKeyId} />
          <CopyField label={t("apiKeys.secret.secretLabel")} value={credentials.accessKeySecret} />
          <div className="flex justify-end">
            <Button onClick={onClose}>{t("apiKeys.secret.done")}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
