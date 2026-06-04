import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc.js";
import { Button } from "@/components/ui/button.js";
import { InputGroup } from "@/components/ui/input.js";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess(data) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/dashboard");
    },
    onError(err) {
      setError(err.message);
    }
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    login.mutate({ email, password });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-emerald-600">QCobro</h1>
          <p className="mt-1 text-sm text-slate-500">Debt collection management</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-slate-900">Sign in</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <InputGroup
              label="Email"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
            <InputGroup
              label="Password"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
