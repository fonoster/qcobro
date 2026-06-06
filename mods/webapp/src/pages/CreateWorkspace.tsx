import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { trpc, REFRESH_TOKEN_KEY } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";

export function CreateWorkspace() {
  const { t } = useI18n();
  const { setTokens, setWorkspace } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const create = trpc.workspaces.create.useMutation();
  const refresh = trpc.auth.refresh.useMutation();

  const [name, setName] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const { ref } = await create.mutateAsync({ name });

    // Re-issue tokens so the newly owned workspace is present in the claims.
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      const res = await refresh.mutateAsync({ refreshToken });
      setTokens(res.accessToken, res.refreshToken);
    }

    const list = await utils.workspaces.list.fetch();
    const created = list.items.find((w) => w.ref === ref) ?? list.items[0];
    if (created) {
      setWorkspace(created.accessKeyId);
    }
    navigate("/");
  }

  const pending = create.isPending || refresh.isPending;

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">{t("workspace.createTitle")}</h1>
      <p className="mt-1 mb-4 text-sm text-gray-500">{t("workspace.createSubtitle")}</p>
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm">
          <span className="text-gray-600">{t("workspace.name")}</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-gray-900 px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? t("workspace.creating") : t("workspace.create")}
        </button>
      </form>
    </div>
  );
}
