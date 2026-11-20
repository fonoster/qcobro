import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight, Info, Plus } from "lucide-react";
import { trpc, REFRESH_TOKEN_KEY } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n } from "../lib/i18n.js";
import { Dialog } from "../components/ui/dialog.js";
import { Button } from "../components/ui/button.js";
import { CopyField } from "../components/CopyField.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { InputGroup } from "../components/ui/input.js";
import { SelectGroup } from "../components/ui/select.js";
import { TIMEZONES } from "../lib/timezones.js";

/** Up to two letters from the workspace name's first words ("Créditos Demo" → "CD"). */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

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
  const [currency, setCurrency] = useState<"USD" | "DOP">("DOP");
  const [timezone, setTimezone] = useState(TIMEZONES[0]);

  const items = workspaces.data ?? [];
  const pending = create.isPending || refresh.isPending;
  const empty = workspaces.isSuccess && items.length === 0;

  function onSelect(accessKeyId: string) {
    setWorkspace(accessKeyId);
    navigate("/");
  }

  async function onCreate() {
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

  const countLabel = t(items.length === 1 ? "workspaces.count.one" : "workspaces.count.other");

  return (
    <>
      <div className="m-auto flex w-full max-w-[640px] flex-col gap-7 px-4 pb-20 pt-12 sm:px-0">
        <div className="flex flex-col gap-2">
          <h1 className="text-[26px] font-semibold leading-tight text-fg">
            {t(empty ? "workspaces.empty.title" : "workspaces.title")}
          </h1>
          <p className="text-sm text-fg-muted">{t("workspaces.subtitle")}</p>
        </div>

        {workspaces.isPending ? (
          <p className="text-sm text-fg-muted">{t("common.loading")}</p>
        ) : empty ? (
          <EmptyState
            icon={<Building2 />}
            title={t("workspaces.empty.heading")}
            body={t("workspaces.empty.body")}
            className="p-10"
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                {t("workspaces.empty.cta")}
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <p className="text-[13px] text-fg-muted">
                {countLabel.replace("{count}", String(items.length))}
              </p>
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                {t("workspaces.create")}
              </Button>
            </div>

            <ul
              aria-label={t("workspaces.listLabel")}
              className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface"
            >
              {items.map((ws) => (
                <li
                  key={ws.accessKeyId}
                  className="relative flex items-center gap-3.5 px-5 py-4 transition hover:bg-elevated"
                >
                  {/* The row's one control; its overlay makes the whole row open the workspace,
                      while the copy control sits above it. */}
                  <button
                    type="button"
                    onClick={() => onSelect(ws.accessKeyId)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated font-mono text-xs font-semibold text-fg"
                    >
                      {initialsOf(ws.name)}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-fg">{ws.name}</span>
                      <span className="truncate text-xs text-fg-muted">
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
                      </span>
                    </span>
                  </button>
                  <CopyField
                    variant="inline"
                    value={ws.accessKeyId}
                    copyAriaLabel={t("createWorkspace.card.accessKeyIdAria")}
                    className="relative z-10 max-w-[150px] text-xs"
                  />
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-fg-muted" />
                </li>
              ))}
            </ul>

            <p className="flex items-center gap-2 text-xs text-fg-muted">
              <Info aria-hidden className="h-3.5 w-3.5 shrink-0" />
              {t("workspaces.inviteHint")}
            </p>
          </>
        )}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        width={560}
        title={t("createWorkspace.modal.title")}
        subtitle={t("createWorkspace.modal.subtitle")}
        confirmLabel={pending ? t("createWorkspace.creating") : t("createWorkspace.create")}
        confirmDisabled={pending}
        onSubmit={onCreate}
      >
        <InputGroup
          id="create-workspace-name"
          label={t("createWorkspace.field.name")}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("createWorkspace.field.namePlaceholder")}
        />

        <SelectGroup label={t("createWorkspace.field.region")} defaultValue="nyc01">
          <option value="nyc01">NYC01</option>
        </SelectGroup>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectGroup
            label={t("settings.currency")}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "USD" | "DOP")}
          >
            <option value="DOP">{t("createWorkspace.currency.DOP")}</option>
            <option value="USD">{t("createWorkspace.currency.USD")}</option>
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
        </div>

        <p className="flex gap-2.5 rounded-control bg-elevated px-3 py-2.5 text-xs text-fg-muted">
          <Info aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          {t("createWorkspace.note")}
        </p>
      </Dialog>
    </>
  );
}
