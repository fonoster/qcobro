import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { Card } from "../components/ui/card.js";
import { InputGroup } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";
import { Logo } from "../components/Logo.js";

/**
 * Requests a password-reset email. Always shows the same "check your email"
 * confirmation regardless of whether the address is registered, so the
 * response can't be used to enumerate accounts.
 */
export function ForgotPassword() {
  const { t } = useI18n();
  const sendCode = trpc.auth.sendResetPasswordCode.useMutation();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await sendCode.mutateAsync({
        username: email,
        resetPasswordUrl: `${window.location.origin}/reset-password`
      });
    } catch {
      // Fall through to the same confirmation state as success — don't reveal
      // whether the address exists.
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex h-[72px] w-full items-center justify-between border-b border-slate-200 bg-white px-10">
        <Logo />
        <Link to="/login" className="text-[13px] font-semibold text-emerald-700 hover:underline">
          {t("forgotPassword.backToLogin")}
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-[400px] rounded-2xl border-slate-200 p-8 shadow-none">
          {sent ? (
            <div className="flex flex-col items-center gap-1.5 text-center">
              <h1 className="text-2xl font-bold text-slate-900">{t("forgotPassword.sentTitle")}</h1>
              <p className="text-sm text-slate-500">
                {t("forgotPassword.sentSubtitle").replace("{email}", email)}
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-7">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-2xl font-bold text-slate-900">{t("forgotPassword.title")}</h1>
                <p className="text-sm text-slate-500">{t("forgotPassword.subtitle")}</p>
              </div>

              <InputGroup
                label={t("auth.email")}
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
              />

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={sendCode.isPending || !email}
              >
                {sendCode.isPending ? t("forgotPassword.sending") : t("forgotPassword.submit")}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
