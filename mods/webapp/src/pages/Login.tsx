import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { AuthBrandPanel } from "../components/AuthBrandPanel.js";
import { InputGroup } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";
import { GoogleButton } from "../components/GoogleButton.js";

export function Login() {
  const { t } = useI18n();
  const { setTokens } = useAuth();
  const navigate = useNavigate();
  const login = trpc.auth.login.useMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const res = await login.mutateAsync({ email, password });
      setTokens(res.accessToken, res.refreshToken, res.idToken);
      navigate("/workspaces");
    } catch {
      setError(t("auth.invalidCredentials"));
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex">
        <AuthBrandPanel />
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-6">
        <form onSubmit={onSubmit} className="flex w-full max-w-[380px] flex-col gap-7">
          <div className="flex flex-col gap-1">
            <h1 className="text-[26px] font-bold text-slate-900">{t("auth.loginTitle")}</h1>
            <p className="text-sm text-slate-500">{t("auth.loginSubtitle")}</p>
          </div>

          <div className="flex flex-col gap-4">
            <InputGroup
              label={t("auth.email")}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
            />
            <div className="flex flex-col gap-1.5">
              <InputGroup
                label={t("auth.password")}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                error={error ?? undefined}
              />
              <Link
                to="/forgot-password"
                className="self-end text-[13px] font-medium text-emerald-700 hover:underline"
              >
                {t("auth.forgot")}
              </Link>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
            {t("auth.login")}
          </Button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[13px] text-slate-400">{t("auth.or")}</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <GoogleButton type="button" size="lg" className="w-full">
            {t("auth.continueGoogle")}
          </GoogleButton>

          <Link
            to="/signup"
            className="text-center text-[13px] font-semibold text-emerald-700 hover:underline"
          >
            {t("auth.noAccount")}
          </Link>
        </form>
      </div>
    </div>
  );
}
