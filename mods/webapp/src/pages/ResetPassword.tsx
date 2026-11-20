import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { InputGroup } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";
import { AuthLayout, AuthHeading } from "../components/AuthLayout.js";

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
    <AuthLayout>
      {!username || !verificationCode ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <AuthHeading
            title={t("resetPassword.invalidTitle")}
            subtitle={t("resetPassword.invalidSubtitle")}
          />
          <Link
            to="/forgot-password"
            className="text-[13px] font-semibold text-fg underline-offset-2 hover:underline"
          >
            {t("resetPassword.invalidCta")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <AuthHeading title={t("resetPassword.title")} subtitle={t("resetPassword.subtitle")} />

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
      <Link
        to="/login"
        className="text-center text-[13px] font-semibold text-fg underline-offset-2 hover:underline"
      >
        {t("resetPassword.backToLogin")}
      </Link>
    </AuthLayout>
  );
}
