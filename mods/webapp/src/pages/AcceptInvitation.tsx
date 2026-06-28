import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";

export function AcceptInvitation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();

  const inviteToken = params.get("token");
  const workspace = params.get("workspace") ?? t("members.wsFallback");
  const inviter = params.get("inviter");
  const role = params.get("role") ?? t("members.role.WORKSPACE_MEMBER");

  const accept = trpc.workspaces.acceptInvitation.useMutation({
    onSuccess: () => navigate(isAuthenticated ? "/" : "/login")
  });

  const subtitle = inviter
    ? t("acceptInvitation.subtitleInviter").replace("{inviter}", inviter).replace("{role}", role)
    : t("acceptInvitation.subtitle").replace("{role}", role);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-[440px] rounded-2xl border-slate-200 p-8 shadow-none">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="text-[22px] font-bold text-slate-900">
              {t("acceptInvitation.title").replace("{ws}", workspace)}
            </h1>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>

          {accept.isError && (
            <p className="text-center text-sm text-red-500">{t("acceptInvitation.error")}</p>
          )}

          <div className="flex flex-col gap-2.5">
            <Button
              size="lg"
              className="w-full"
              disabled={accept.isPending || !inviteToken}
              onClick={() => {
                if (inviteToken) accept.mutate({ token: inviteToken });
              }}
            >
              {accept.isPending ? t("auth.processing") : t("auth.acceptInvitation")}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="w-full text-slate-500"
              onClick={() => navigate("/")}
            >
              {t("acceptInvitation.reject")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
