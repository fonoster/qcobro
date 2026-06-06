import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";

export function Login() {
  const { t } = useI18n();
  const { setTokens } = useAuth();
  const navigate = useNavigate();
  const login = trpc.auth.login.useMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const res = await login.mutateAsync({ email, password });
      setTokens(res.accessToken, res.refreshToken);
      navigate("/");
    } catch {
      setError(t("auth.invalidCredentials"));
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-semibold">{t("auth.loginTitle")}</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="text-gray-600">{t("auth.email")}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-600">{t("auth.password")}</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
        >
          {t("auth.login")}
        </button>
      </form>
      <Link to="/signup" className="mt-4 block text-sm text-gray-600 hover:underline">
        {t("auth.noAccount")}
      </Link>
    </div>
  );
}
