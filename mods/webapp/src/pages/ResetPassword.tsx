import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { Card } from "../components/ui/card.js";
import { InputGroup } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";
import { Logo } from "../components/Logo.js";

/**
 * Sets a new password from the link emailed by sendResetPasswordCode. Identity
 * appends a single `?token=` param: base64 JSON of `{ username, code }` (see
 * @fonoster/identity's createSendResetPasswordCode). There's no code-entry
 * field here — just the new password.
 */
function decodeToken(token: string | null): { username: string; verificationCode: string } | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token)) as { username?: string; code?: string };
    if (!payload.username || !payload.code) return null;
    return { username: payload.username, verificationCode: payload.code };
  } catch {
    return null;
  }
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const resetPassword = trpc.auth.resetPassword.useMutation();

  const decoded = decodeToken(params.get("token"));
  const username = decoded?.username ?? null;
  const verificationCode = decoded?.verificationCode ?? null;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t("resetPassword.mismatch"));
      return;
    }
    try {
      await resetPassword.mutateAsync({
        username: username as string,
        password,
        verificationCode: verificationCode as string
      });
      navigate("/login");
    } catch {
      setError(t("resetPassword.error"));
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex h-[72px] w-full items-center justify-between border-b border-slate-200 bg-white px-10">
        <Logo />
        <Link to="/login" className="text-[13px] font-semibold text-emerald-700 hover:underline">
          {t("resetPassword.backToLogin")}
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-[400px] rounded-2xl border-slate-200 p-8 shadow-none">
          {!username || !verificationCode ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-2xl font-bold text-slate-900">
                  {t("resetPassword.invalidTitle")}
                </h1>
                <p className="text-sm text-slate-500">{t("resetPassword.invalidSubtitle")}</p>
              </div>
              <Link
                to="/forgot-password"
                className="text-[13px] font-semibold text-emerald-700 hover:underline"
              >
                {t("resetPassword.invalidCta")}
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-7">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-2xl font-bold text-slate-900">{t("resetPassword.title")}</h1>
                <p className="text-sm text-slate-500">{t("resetPassword.subtitle")}</p>
              </div>

              <div className="flex flex-col gap-4">
                <InputGroup
                  label={t("resetPassword.newPassword")}
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <InputGroup
                  label={t("resetPassword.confirmPassword")}
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  error={error ?? undefined}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={resetPassword.isPending || !password || !confirmPassword}
              >
                {resetPassword.isPending ? t("resetPassword.resetting") : t("resetPassword.submit")}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
