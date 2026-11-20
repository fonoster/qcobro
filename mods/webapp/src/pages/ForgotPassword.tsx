import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { InputGroup } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";
import { AuthLayout, AuthHeading } from "../components/AuthLayout.js";

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
    <AuthLayout>
      {sent ? (
        <AuthHeading
          title={t("forgotPassword.sentTitle")}
          subtitle={t("forgotPassword.sentSubtitle").replace("{email}", email)}
        />
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <AuthHeading title={t("forgotPassword.title")} subtitle={t("forgotPassword.subtitle")} />

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
      <Link
        to="/login"
        className="text-center text-[13px] font-semibold text-primary hover:underline"
      >
        {t("forgotPassword.backToLogin")}
      </Link>
    </AuthLayout>
  );
}
