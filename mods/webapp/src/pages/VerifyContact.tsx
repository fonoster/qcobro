import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { Card } from "../components/ui/card.js";
import { InputGroup } from "../components/ui/input.js";
import { Button } from "../components/ui/button.js";

/**
 * Email contact verification, shown right after sign-up. The user is already
 * authenticated here, so the address to verify is read from the session. A code
 * is sent on mount; entering it confirms the contact. Verification is a soft
 * gate — "Omitir por ahora" lets the user continue into the console.
 */
export function VerifyContact() {
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const send = trpc.auth.sendVerificationCode.useMutation();
  const verify = trpc.auth.verifyCode.useMutation();

  const email = currentUser?.email ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);

  // Send the initial code once when the screen opens.
  const requested = useRef(false);
  useEffect(() => {
    if (!email || requested.current) return;
    requested.current = true;
    send.mutate({ contactType: "EMAIL", value: email });
  }, [email, send]);

  if (!email) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await verify.mutateAsync({
        username: email,
        contactType: "EMAIL",
        value: email,
        verificationCode: code.trim()
      });
      navigate("/workspaces");
    } catch {
      setError(t("verify.failed"));
    }
  }

  function onResend() {
    setSent(false);
    setResending(true);
    send.mutate(
      { contactType: "EMAIL", value: email },
      {
        onSuccess: () => {
          setSent(true);
          setResending(false);
        },
        onError: () => setResending(false)
      }
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-[400px] rounded-2xl border-slate-200 p-8 shadow-none">
        <form onSubmit={onSubmit} className="flex flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold text-slate-900">{t("verify.title")}</h1>
            <p className="text-sm text-slate-500">{t("verify.subtitle")}</p>
          </div>

          <InputGroup
            label={t("verify.codeLabel")}
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="••••••"
            error={error ?? undefined}
            hint={sent ? t("verify.sent") : undefined}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={verify.isPending || !code.trim()}
          >
            {verify.isPending ? t("verify.verifying") : t("verify.submit")}
          </Button>

          <div className="flex items-center justify-between text-[13px]">
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className="font-semibold text-emerald-700 hover:underline disabled:opacity-50"
            >
              {t("verify.resend")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/workspaces")}
              className="text-slate-500 hover:underline"
            >
              {t("verify.skip")}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
