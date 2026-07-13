import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { Card } from "../components/ui/card.js";
import { InputGroup } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";
import { GoogleButton } from "../components/GoogleButton.js";
import { Logo } from "../components/Logo.js";

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
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex h-[72px] w-full items-center justify-between border-b border-slate-200 bg-white px-10">
        <Logo />
        <p className="text-[13px] text-slate-500">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="font-semibold text-emerald-700 hover:underline">
            {t("auth.login")}
          </Link>
        </p>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-[400px] rounded-2xl border-slate-200 p-8 shadow-none">
          <form onSubmit={onSubmit} className="flex flex-col gap-7">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-bold text-slate-900">{t("auth.signupTitle")}</h1>
              <p className="text-sm text-slate-500">{t("auth.signupSubtitle")}</p>
            </div>

            <div className="flex flex-col gap-4">
              <InputGroup
                label={t("auth.name")}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.namePlaceholder")}
              />
              <InputGroup
                label={t("auth.email")}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
              />
              <InputGroup
                label={t("auth.password")}
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                error={error ?? undefined}
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {t("auth.signup")}
            </Button>

            <GoogleButton type="button" size="lg" className="w-full">
              {t("auth.continueGoogle")}
            </GoogleButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
