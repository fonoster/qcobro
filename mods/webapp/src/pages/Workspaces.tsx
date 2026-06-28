import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, Settings } from "lucide-react";
import { trpc, REFRESH_TOKEN_KEY } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { CopyField } from "../components/CopyField.js";
import { InputGroup } from "../components/ui/input.js";
import { SelectGroup } from "../components/ui/select.js";
import { TIMEZONES } from "../lib/timezones.js";

export function Workspaces() {
  const { setTokens, setWorkspace } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const workspaces = trpc.workspaces.summaries.useQuery();
  const create = trpc.workspaces.create.useMutation();
  const refresh = trpc.auth.refresh.useMutation();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<"USD" | "DOP">("USD");
  const [timezone, setTimezone] = useState(TIMEZONES[0]);

  const items = workspaces.data ?? [];
  const pending = create.isPending || refresh.isPending;

  function onSelect(accessKeyId: string) {
    setWorkspace(accessKeyId);
    navigate("/");
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const { ref } = await create.mutateAsync({ name, currency, timezone });

    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      const res = await refresh.mutateAsync({ refreshToken });
      setTokens(res.accessToken, res.refreshToken, res.idToken);
    }

    await utils.workspaces.summaries.invalidate();
    const list = await utils.workspaces.summaries.fetch();
    const created = list.find((w) => w.ref === ref) ?? list[0];
    if (created) setWorkspace(created.accessKeyId);
    // AuthedLayout reads workspaces.list (cached empty from the pre-workspace visit to "/").
    // Invalidate it so the dashboard sees the new workspace instead of bouncing back here.
    await utils.workspaces.list.invalidate();
    navigate("/");
  }

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-10 py-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-[28px] font-bold text-slate-900">
            {t("createWorkspace.welcome.title")}
          </h1>
          <p className="text-base text-slate-500">{t("createWorkspace.welcome.subtitle")}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          {items.slice(0, 3).map((ws) => (
            <div
              key={ws.accessKeyId}
              onClick={() => onSelect(ws.accessKeyId)}
              className="relative flex h-[200px] w-[280px] cursor-pointer flex-col justify-between rounded-[10px] border border-slate-200 bg-white p-6 text-left transition hover:border-emerald-300 hover:shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <p className="text-[17px] font-bold text-slate-900">{ws.name}</p>
                <p className="text-[13px] text-slate-400">
                  {ws.portfolioCount}{" "}
                  {t(
                    ws.portfolioCount === 1
                      ? "createWorkspace.card.portfolio"
                      : "createWorkspace.card.portfolios"
                  )}{" "}
                  · {ws.memberCount}{" "}
                  {t(
                    ws.memberCount === 1
                      ? "createWorkspace.card.member"
                      : "createWorkspace.card.members"
                  )}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <CopyField
                  variant="inline"
                  value={ws.accessKeyId}
                  copyAriaLabel={t("createWorkspace.card.accessKeyIdAria")}
                  className="max-w-[150px] rounded-md bg-slate-100 px-2 py-1 text-slate-600 hover:bg-slate-200"
                />
                <button
                  type="button"
                  aria-label={t("settings.title")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setWorkspace(ws.accessKeyId);
                    navigate("/settings");
                  }}
                  className="shrink-0 text-slate-400 transition hover:text-slate-700"
                >
                  <Settings className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setOpen(true)}
            className="flex h-[200px] w-[280px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-slate-300 bg-white text-slate-400 transition hover:border-emerald-400 hover:text-emerald-600"
          >
            <Plus className="h-7 w-7" />
            <span className="text-[15px] font-semibold">{t("createWorkspace.new")}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 p-4">
          <Card className="w-full max-w-[480px] rounded-2xl border-slate-200 shadow-xl">
            <form onSubmit={onCreate} className="flex flex-col gap-5 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[18px] font-bold text-slate-900">
                    {t("createWorkspace.modal.title")}
                  </h2>
                  <p className="text-[13px] text-slate-500">
                    {t("createWorkspace.modal.subtitle")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="cursor-pointer text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <InputGroup
                label={t("createWorkspace.field.name")}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("createWorkspace.field.namePlaceholder")}
              />

              <SelectGroup label={t("createWorkspace.field.region")} defaultValue="nyc01">
                <option value="nyc01">NYC01</option>
              </SelectGroup>

              <SelectGroup
                label={t("settings.currency")}
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "USD" | "DOP")}
              >
                <option value="USD">USD</option>
                <option value="DOP">DOP</option>
              </SelectGroup>

              <SelectGroup
                label={t("settings.timezone")}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </SelectGroup>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? t("createWorkspace.creating") : t("createWorkspace.create")}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
