import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import {
  AuthLayout,
  AuthHeading,
  AuthOrDivider,
  AuthFooterLine
} from "../components/AuthLayout.js";
import { InputGroup } from "../components/ui/input.js";
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

      <div className="flex flex-col gap-4">
        <GoogleButton type="button" className="h-10 w-full">
          {t("auth.continueGoogle")}
        </GoogleButton>

        <AuthOrDivider label={t("auth.or")} />

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
          <InputGroup
            id="login-password"
            label={t("auth.password")}
            labelEnd={
              <Link
                to="/forgot-password"
                className="underline-offset-2 hover:text-fg hover:underline"
              >
                {t("auth.forgot")}
              </Link>
            }
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button type="submit" className="h-10 w-full" disabled={login.isPending}>
            {t("auth.login")}
          </Button>
        </form>

        <AuthFooterLine text={t("auth.noAccount")} to="/signup" link={t("auth.createOne")} />
      </div>
    </AuthLayout>
  );
}
