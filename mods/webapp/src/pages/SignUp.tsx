import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { AuthLayout, AuthHeading } from "../components/AuthLayout.js";
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
    <AuthLayout>
      <AuthHeading title={t("auth.signupTitle")} subtitle={t("auth.signupSubtitle")} />

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
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {t("auth.signup")}
        </Button>
      </form>

      <p className="text-center text-[13px] text-fg-subtle">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="font-semibold text-fg underline-offset-2 hover:underline">
          {t("auth.login")}
        </Link>
      </p>
    </AuthLayout>
  );
}
