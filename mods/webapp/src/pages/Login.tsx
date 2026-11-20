import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { AuthLayout, AuthHeading } from "../components/AuthLayout.js";
import { Input, InputGroup } from "../components/ui/input.js";
import { Alert } from "../components/ui/alert.js";
import { Button } from "../components/ui/button.js";
import { GoogleButton } from "../components/GoogleButton.js";

export function Login() {
  const { t } = useI18n();
  const { setTokens } = useAuth();
  const navigate = useNavigate();
  const login = trpc.auth.login.useMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFailed(false);
    try {
      const res = await login.mutateAsync({ email, password });
      setTokens(res.accessToken, res.refreshToken, res.idToken);
      navigate("/workspaces");
    } catch {
      // The API can't tell which field is wrong, so the alert names neither.
      setFailed(true);
    }
  }

  return (
    <AuthLayout>
      <AuthHeading title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")} />

      {failed && (
        <Alert
          variant="error"
          title={t("auth.invalidCredentials.title")}
          description={t("auth.invalidCredentials.body")}
        />
      )}

      <GoogleButton type="button" size="lg" className="w-full">
        {t("auth.continueGoogle")}
      </GoogleButton>

      <div className="flex items-center gap-3 text-[13px] text-fg-subtle">
        <span className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <InputGroup
            id="login-email"
            label={t("auth.email")}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="login-password" className="text-sm font-medium text-fg-muted">
                {t("auth.password")}
              </label>
              <Link
                to="/forgot-password"
                className="text-[13px] font-medium text-fg underline-offset-2 hover:underline"
              >
                {t("auth.forgot")}
              </Link>
            </div>
            <Input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {t("auth.login")}
        </Button>
      </form>

      <p className="text-center text-[13px] text-fg-subtle">
        {t("auth.noAccount")}{" "}
        <Link to="/signup" className="font-semibold text-fg underline-offset-2 hover:underline">
          {t("auth.createOne")}
        </Link>
      </p>
    </AuthLayout>
  );
}
