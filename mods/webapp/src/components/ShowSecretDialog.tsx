import { useI18n } from "../lib/i18n.js";
import { Dialog } from "./ui/dialog.js";
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
  return (
    <Dialog
      open={!!credentials}
      onClose={onClose}
      title={t("apiKeys.secret.title")}
      subtitle={t("apiKeys.secret.description")}
      footer={<Button onClick={onClose}>{t("apiKeys.secret.done")}</Button>}
    >
      {credentials && (
        <>
          <CopyField label={t("apiKeys.secret.idLabel")} value={credentials.accessKeyId} />
          <CopyField label={t("apiKeys.secret.secretLabel")} value={credentials.accessKeySecret} />
        </>
      )}
    </Dialog>
  );
}
