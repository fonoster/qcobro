import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
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
import { Button } from "../components/ui/button.js";
import { GoogleButton } from "../components/GoogleButton.js";

export function SignUp() {
  const { t } = useI18n();
  const { setTokens } = useAuth();
  const navigate = useNavigate();
  const signUp = trpc.auth.signUp.useMutation();
  const login = trpc.auth.login.useMutation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await signUp.mutateAsync({ name, email, password });
      const res = await login.mutateAsync({ email, password });
      setTokens(res.accessToken, res.refreshToken, res.idToken);
      // New accounts land on contact verification before entering the console.
      navigate("/verify-contact");
    } catch {
      setError(t("auth.signupFailed"));
    }
  }

  const pending = signUp.isPending || login.isPending;

  return (
    <AuthLayout
      footer={<AuthFooterLine text={t("auth.haveAccount")} to="/login" link={t("auth.login")} />}
    >
      <AuthHeading title={t("auth.signupTitle")} subtitle={t("auth.signupSubtitle")} />

      <div className="flex flex-col gap-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <InputGroup
            id="signup-name"
            label={t("auth.name")}
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.namePlaceholder")}
          />
          <InputGroup
            id="signup-email"
            label={t("auth.email")}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
          />
          <InputGroup
            id="signup-password"
            label={t("auth.passwordWithRule")}
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            error={error ?? undefined}
          />

          <Button type="submit" className="h-10 w-full" disabled={pending}>
            {t("auth.signup")}
          </Button>
        </form>

        <AuthOrDivider label={t("auth.or")} />

        <GoogleButton type="button" className="h-10 w-full">
          {t("auth.continueGoogle")}
        </GoogleButton>
      </div>
    </AuthLayout>
  );
}
