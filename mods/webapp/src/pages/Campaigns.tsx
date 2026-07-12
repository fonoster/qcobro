import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { PageHeader } from "../components/page-header.js";
import { BillingPausedNotice } from "../components/BillingPausedNotice.js";
import { DataTable } from "../components/ui/data-table.js";
import { Dialog } from "../components/ui/dialog.js";
import { ConfirmDeleteDialog } from "../components/ui/confirm-delete-dialog.js";
import { InputGroup } from "../components/ui/input.js";
import { SelectGroup, FilterSelect } from "../components/ui/select.js";
import { Badge } from "../components/ui/badge.js";
import { RowActionsMenu, type RowAction } from "../components/ui/row-actions-menu.js";
import { humanizeDays, ALL_DAYS } from "../lib/campaignDays.js";

type CampaignStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  daysOfWeek: number[];
  startDate: Date | string;
  endDate: Date | string | null;
  startTime: string;
  endTime: string;
  maxAttemptsPerAccount: number;
  maxAttemptsPerDay: number;
  createdAt: Date | string;
  agentTemplate?: { name: string; type: string } | null;
};

function statusVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "PAUSED") return "orange";
  if (status === "COMPLETED") return "violet";
  return "secondary";
}

const STATUS_FILTERS: CampaignStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

export function Campaigns() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [statusFilter, setStatusFilter] = useState<"" | CampaignStatus>("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);

  const { data } = trpc.campaigns.list.useQuery(
    statusFilter ? { status: statusFilter } : undefined
  );
  const campaigns: Campaign[] = (data ?? []) as Campaign[];

  function invalidate() {
    utils.campaigns.list.invalidate();
  }

  const updateStatus = trpc.campaigns.updateStatus.useMutation({ onSuccess: invalidate });
  const del = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      setDeleting(null);
      invalidate();
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <BillingPausedNotice />
      <PageHeader title={t("campaigns.title")} description={t("campaigns.description")} />

      <DataTable
        data={campaigns}
        keyField="id"
        searchable={false}
        filterElement={
          <FilterSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | CampaignStatus)}
          >
            <option value="">{t("campaigns.filter.default")}</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {t(`campaigns.filter.${s}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </FilterSelect>
        }
        actionLabel={t("campaigns.new")}
        onAction={() => setShowCreate(true)}
        onRowClick={(row) => navigate(`/campaigns/${row.id}`)}
        columns={[
          { key: "name", header: t("campaigns.col.name") },
          {
            key: "agentTemplate",
            header: t("campaigns.col.agent"),
            render: (r) => r.agentTemplate?.name ?? "—"
          },
          {
            key: "daysOfWeek",
            header: t("campaigns.col.days"),
            render: (r) => humanizeDays(r.daysOfWeek ?? [], t)
          },
          {
            key: "time",
            header: t("campaigns.col.time"),
            render: (r) => `${r.startTime}–${r.endTime}`
          },
          {
            key: "status",
            header: t("campaigns.col.status"),
            render: (r) => (
              <Badge variant={statusVariant(r.status)}>
                {t(`campaigns.status.${r.status}` as Parameters<typeof t>[0])}
              </Badge>
            )
          },
          {
            key: "id",
            header: "",
            align: "right",
            className: "w-px whitespace-nowrap",
            render: (r) => {
              const items: RowAction[] = [
                {
                  label: t("campaigns.actions.view"),
                  onClick: () => navigate(`/campaigns/${r.id}`)
                },
                {
                  label: t("campaigns.actions.edit"),
                  onClick: () => setEditing(r)
                }
              ];
              if (r.status === "ACTIVE") {
                items.push({
                  label: t("campaigns.actions.pause"),
                  onClick: () => updateStatus.mutate({ id: r.id, status: "PAUSED" })
                });
              } else if (r.status === "PAUSED") {
                items.push({
                  label: t("campaigns.actions.activate"),
                  onClick: () => updateStatus.mutate({ id: r.id, status: "ACTIVE" })
                });
              }
              if (r.status === "ARCHIVED") {
                items.push({
                  label: t("campaigns.actions.restore"),
                  onClick: () => updateStatus.mutate({ id: r.id, status: "PAUSED" })
                });
              } else {
                items.push({
                  label: t("campaigns.actions.archive"),
                  onClick: () => updateStatus.mutate({ id: r.id, status: "ARCHIVED" })
                });
                items.push({
                  label: t("campaigns.actions.delete"),
                  onClick: () => setDeleting(r),
                  variant: "destructive" as const
                });
              }
              return <RowActionsMenu items={items} />;
            }
          }
        ]}
      />

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            invalidate();
          }}
        />
      )}

      {editing && (
        <EditCampaignModal
          campaign={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate({ id: deleting.id })}
        isPending={del.isPending}
        title={`${t("campaigns.delete.title")} "${deleting?.name ?? ""}"`}
        description={t("campaigns.delete.description")}
      />
    </div>
  );
}

function toDateInput(val: Date | string | null | undefined): string {
  if (!val) return "";
  return new Date(val).toISOString().slice(0, 10);
}

function EditCampaignModal({
  campaign,
  onClose,
  onSuccess
}: {
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(campaign.name);
  const [startDate, setStartDate] = useState(toDateInput(campaign.startDate));
  const [endDate, setEndDate] = useState(toDateInput(campaign.endDate));
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(campaign.daysOfWeek ?? [1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState(campaign.startTime);
  const [endTime, setEndTime] = useState(campaign.endTime);
  const [maxPerAccount, setMaxPerAccount] = useState(campaign.maxAttemptsPerAccount);
  const [maxPerDay, setMaxPerDay] = useState(campaign.maxAttemptsPerDay);
  const [error, setError] = useState<string | null>(null);

  const update = trpc.campaigns.update.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function toggleDay(d: number) {
    setDaysOfWeek((ds) =>
      ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort((a, b) => a - b)
    );
  }

  function handleSave() {
    if (!name.trim()) return setError(t("campaigns.form.name"));
    if (daysOfWeek.length === 0) return setError(t("campaigns.form.noDays"));
    setError(null);
    update.mutate({
      id: campaign.id,
      name: name.trim(),
      startDate,
      endDate: endDate || undefined,
      daysOfWeek,
      startTime,
      endTime,
      maxAttemptsPerAccount: maxPerAccount,
      maxAttemptsPerDay: maxPerDay
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("campaigns.form.editTitle")}
      confirmLabel={update.isPending ? "…" : t("campaigns.form.save")}
      onConfirm={handleSave}
    >
      <div className="mt-4 flex flex-col gap-3">
        <InputGroup
          label={t("campaigns.form.name")}
          id="e-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">{t("campaigns.form.days")}</span>
          <div className="flex gap-1.5">
            {ALL_DAYS.map((d) => {
              const selected = daysOfWeek.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={
                    selected
                      ? "flex-1 rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white"
                      : "flex-1 rounded-md border border-slate-200 py-2 text-sm font-semibold text-slate-500"
                  }
                >
                  {t(`campaigns.days.${d}` as Parameters<typeof t>[0])}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InputGroup
            label={t("campaigns.form.startDate")}
            id="e-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <InputGroup
            label={t("campaigns.form.endDate")}
            id="e-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <InputGroup
            label={t("campaigns.form.startTime")}
            id="e-startt"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <InputGroup
            label={t("campaigns.form.endTime")}
            id="e-endt"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <InputGroup
            label={t("campaigns.form.maxPerAccount")}
            id="e-maxacc"
            type="number"
            value={String(maxPerAccount)}
            onChange={(e) => setMaxPerAccount(Number(e.target.value))}
          />
          <InputGroup
            label={t("campaigns.form.maxPerDay")}
            id="e-maxday"
            type="number"
            value={String(maxPerDay)}
            onChange={(e) => setMaxPerDay(Number(e.target.value))}
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}

function CreateCampaignModal({
  onClose,
  onSuccess
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [portfolioIds, setPortfolioIds] = useState<string[]>([]);
  const [agentTemplateId, setAgentTemplateId] = useState("");
  const [whatsAppSenderNumberId, setWhatsAppSenderNumberId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [maxPerAccount, setMaxPerAccount] = useState(5);
  const [maxPerDay, setMaxPerDay] = useState(2);
  const [error, setError] = useState<string | null>(null);

  const portfolios = trpc.portfolios.list.useQuery();
  const agents = trpc.agentTemplates.list.useQuery();
  const selectedAgent = (agents.data ?? []).find((a) => a.id === agentTemplateId) as
    | { id: string; name: string; type: string }
    | undefined;
  const isWhatsApp = selectedAgent?.type === "WHATSAPP";
  const senders = trpc.whatsAppIntegration.listSenders.useQuery(undefined, {
    enabled: isWhatsApp
  });

  const create = trpc.campaigns.create.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function togglePortfolio(id: string) {
    setPortfolioIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function toggleDay(d: number) {
    setDaysOfWeek((ds) =>
      ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort((a, b) => a - b)
    );
  }

  function handleCreate() {
    if (!name.trim()) return setError(t("campaigns.form.name"));
    if (portfolioIds.length === 0) return setError(t("campaigns.form.noPortfolios"));
    if (!agentTemplateId) return setError(t("campaigns.form.noAgents"));
    if (!startDate) return setError(t("campaigns.form.startDate"));
    if (daysOfWeek.length === 0) return setError(t("campaigns.form.noDays"));
    if (isWhatsApp && !whatsAppSenderNumberId) {
      return setError(t("campaigns.form.noWhatsAppSender"));
    }
    setError(null);
    create.mutate({
      name: name.trim(),
      portfolioIds,
      agentTemplateId,
      startDate,
      endDate: endDate || undefined,
      daysOfWeek,
      startTime,
      endTime,
      maxAttemptsPerAccount: maxPerAccount,
      maxAttemptsPerDay: maxPerDay,
      ...(isWhatsApp && whatsAppSenderNumberId ? { whatsAppSenderNumberId } : {})
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("campaigns.new")}
      confirmLabel={create.isPending ? "…" : t("campaigns.form.create")}
      onConfirm={handleCreate}
    >
      <div className="mt-4 flex flex-col gap-3">
        <InputGroup
          label={t("campaigns.form.name")}
          id="c-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">
            {t("campaigns.form.portfolios")}
          </span>
          <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {(portfolios.data ?? []).map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={portfolioIds.includes(p.id)}
                  onChange={() => togglePortfolio(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>

        <SelectGroup
          label={t("campaigns.form.agent")}
          id="c-agent"
          value={agentTemplateId}
          onChange={(e) => {
            setAgentTemplateId(e.target.value);
            setWhatsAppSenderNumberId("");
          }}
        >
          <option value="">—</option>
          {(agents.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectGroup>

        {isWhatsApp && (
          <SelectGroup
            label={t("campaigns.form.whatsAppSender")}
            id="c-wa-sender"
            value={whatsAppSenderNumberId}
            onChange={(e) => setWhatsAppSenderNumberId(e.target.value)}
          >
            <option value="">—</option>
            {((senders.data ?? []) as { id: string; displayNumber: string; label: string }[]).map(
              (s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.displayNumber})
                </option>
              )
            )}
          </SelectGroup>
        )}
        {isWhatsApp && !senders.isLoading && (senders.data ?? []).length === 0 && (
          <p className="text-xs text-amber-700">{t("campaigns.form.noWhatsAppSender")}</p>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">{t("campaigns.form.days")}</span>
          <div className="flex gap-1.5">
            {ALL_DAYS.map((d) => {
              const selected = daysOfWeek.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={
                    selected
                      ? "flex-1 rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white"
                      : "flex-1 rounded-md border border-slate-200 py-2 text-sm font-semibold text-slate-500"
                  }
                >
                  {t(`campaigns.days.${d}` as Parameters<typeof t>[0])}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InputGroup
            label={t("campaigns.form.startDate")}
            id="c-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <InputGroup
            label={t("campaigns.form.endDate")}
            id="c-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <InputGroup
            label={t("campaigns.form.startTime")}
            id="c-startt"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <InputGroup
            label={t("campaigns.form.endTime")}
            id="c-endt"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <InputGroup
            label={t("campaigns.form.maxPerAccount")}
            id="c-maxacc"
            type="number"
            value={String(maxPerAccount)}
            onChange={(e) => setMaxPerAccount(Number(e.target.value))}
          />
          <InputGroup
            label={t("campaigns.form.maxPerDay")}
            id="c-maxday"
            type="number"
            value={String(maxPerDay)}
            onChange={(e) => setMaxPerDay(Number(e.target.value))}
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
