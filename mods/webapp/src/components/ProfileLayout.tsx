import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { AuthedLayout } from "./AuthedLayout.js";
import { AccountLayout } from "./AccountLayout.js";

/** The frame of /profile: the app shell (sidebar, no item active) once the user has a
 * workspace, and the account top bar while they have none, so a user without a workspace can
 * still reach their account. */
export function ProfileLayout() {
  const { t } = useI18n();
  const workspaces = trpc.workspaces.list.useQuery();

  if (workspaces.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-fg-muted">
        {t("common.loading")}
      </div>
    );
  }
  const hasWorkspace = (workspaces.data?.items.length ?? 0) > 0;
  return hasWorkspace ? <AuthedLayout /> : <AccountLayout padded />;
}
