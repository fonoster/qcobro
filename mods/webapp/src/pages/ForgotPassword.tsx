import { useState, type FormEvent } from "react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { InputGroup } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";
import { AuthLayout, AuthHeading, AuthBackLink } from "../components/AuthLayout.js";

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

  async function send() {
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await send();
  }

  return (
    <AuthLayout footer={<AuthBackLink>{t("forgotPassword.backToLogin")}</AuthBackLink>}>
      {sent ? (
        <>
          <AuthHeading
            title={t("forgotPassword.sentTitle")}
            subtitle={t("forgotPassword.sentSubtitle").replace("{email}", email)}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full"
            disabled={sendCode.isPending}
            onClick={() => void send()}
          >
            {sendCode.isPending ? t("forgotPassword.sending") : t("forgotPassword.resend")}
          </Button>
        </>
      ) : (
        <>
          <AuthHeading title={t("forgotPassword.title")} subtitle={t("forgotPassword.subtitle")} />
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <InputGroup
              id="forgot-email"
              label={t("auth.email")}
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
            />

            <Button type="submit" className="h-10 w-full" disabled={sendCode.isPending || !email}>
              {sendCode.isPending ? t("forgotPassword.sending") : t("forgotPassword.submit")}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
