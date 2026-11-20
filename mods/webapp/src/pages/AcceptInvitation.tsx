import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button.js";
import { AuthLayout, AuthHeading } from "../components/AuthLayout.js";
import { trpc, REFRESH_TOKEN_KEY } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";

export function AcceptInvitation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, setTokens } = useAuth();
  const { t } = useI18n();
  const utils = trpc.useUtils();

  const inviteToken = params.get("token");
  const workspace = params.get("workspace") ?? t("members.wsFallback");
  const inviter = params.get("inviter");
  const role = params.get("role") ?? t("members.role.WORKSPACE_MEMBER");

  const accept = trpc.workspaces.acceptInvitation.useMutation();
  const refresh = trpc.auth.refresh.useMutation();

  async function onAccept(token: string) {
    await accept.mutateAsync({ token });
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    // The access token lists the workspaces the user can act in, so refresh it (as creating a
    // workspace does) for the new membership to work without signing in again.
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        const res = await refresh.mutateAsync({ refreshToken });
        setTokens(res.accessToken, res.refreshToken, res.idToken);
      } catch {
        // The invitation is accepted either way; signing in again picks up the membership.
      }
    }
    await Promise.all([
      utils.workspaces.summaries.invalidate(),
      utils.workspaces.list.invalidate()
    ]);
    navigate("/");
  }

  const pending = accept.isPending || refresh.isPending;
  const subtitle = inviter
    ? t("acceptInvitation.subtitleInviter").replace("{inviter}", inviter).replace("{role}", role)
    : t("acceptInvitation.subtitle").replace("{role}", role);

  return (
    <AuthLayout>
      <AuthHeading
        title={t("acceptInvitation.title").replace("{ws}", workspace)}
        subtitle={subtitle}
      />

      {accept.isError && (
        <p className="text-center text-sm text-danger">{t("acceptInvitation.error")}</p>
      )}

      <div className="flex flex-col gap-2.5">
        <Button
          size="lg"
          className="w-full"
          disabled={pending || !inviteToken}
          onClick={() => {
            if (inviteToken) onAccept(inviteToken).catch(() => undefined);
          }}
        >
          {pending ? t("auth.processing") : t("auth.acceptInvitation")}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="w-full text-fg-subtle"
          onClick={() => navigate("/")}
        >
          {t("acceptInvitation.reject")}
        </Button>
      </div>
    </AuthLayout>
  );
}
