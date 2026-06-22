import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable } from "../components/ui/data-table.js";
import { Dialog } from "../components/ui/dialog.js";
import { ConfirmDeleteDialog } from "../components/ui/confirm-delete-dialog.js";
import { InputGroup } from "../components/ui/input.js";
import { SelectGroup, FilterSelect } from "../components/ui/select.js";
import { Badge } from "../components/ui/badge.js";
import { RowActionsMenu, type RowAction } from "../components/ui/row-actions-menu.js";

type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  startTime: string;
  endTime: string;
  createdAt: Date | string;
  agentTemplate?: { name: string; type: string } | null;
};

function statusVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "PAUSED") return "orange";
  if (status === "DRAFT") return "violet";
  return "secondary";
}

const STATUS_FILTERS: CampaignStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

export function Campaigns() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [statusFilter, setStatusFilter] = useState<"" | CampaignStatus>("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<Campaign | null>(null);

  const { data } = trpc.campaigns.list.useQuery(
    statusFilter ? { status: statusFilter } : undefined
  );
  const campaigns: Campaign[] = (data ?? []) as Campaign[];

  function invalidate() {
    utils.campaigns.list.invalidate();
  }

  const update = trpc.campaigns.update.useMutation({ onSuccess: invalidate });
  const del = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      setDeleting(null);
      invalidate();
    }
  });

  return (
    <div className="flex flex-col gap-6">
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
            key: "schedule",
            header: t("campaigns.col.schedule"),
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
            key: "createdAt",
            header: t("campaigns.col.created"),
            render: (r) => new Date(r.createdAt).toLocaleDateString()
          },
          {
            key: "id",
            header: "",
            align: "center",
            render: (r) => {
              const items: RowAction[] = [
                {
                  label: t("campaigns.actions.view"),
                  onClick: () => navigate(`/campaigns/${r.id}`)
                }
              ];
              if (r.status === "ACTIVE") {
                items.push({
                  label: t("campaigns.actions.pause"),
                  onClick: () => update.mutate({ id: r.id, status: "PAUSED" })
                });
              } else if (r.status === "DRAFT" || r.status === "PAUSED") {
                items.push({
                  label: t("campaigns.actions.activate"),
                  onClick: () => update.mutate({ id: r.id, status: "ACTIVE" })
                });
              }
              if (r.status === "DRAFT") {
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [maxPerAccount, setMaxPerAccount] = useState(5);
  const [maxPerDay, setMaxPerDay] = useState(2);
  const [error, setError] = useState<string | null>(null);

  const portfolios = trpc.portfolios.list.useQuery();
  const agents = trpc.agentTemplates.list.useQuery();

  const create = trpc.campaigns.create.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function togglePortfolio(id: string) {
    setPortfolioIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function handleCreate() {
    if (!name.trim()) return setError(t("campaigns.form.name"));
    if (portfolioIds.length === 0) return setError(t("campaigns.form.noPortfolios"));
    if (!agentTemplateId) return setError(t("campaigns.form.noAgents"));
    if (!startDate) return setError(t("campaigns.form.startDate"));
    setError(null);
    create.mutate({
      name: name.trim(),
      portfolioIds,
      agentTemplateId,
      startDate,
      endDate: endDate || undefined,
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
          onChange={(e) => setAgentTemplateId(e.target.value)}
        >
          <option value="">—</option>
          {(agents.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectGroup>

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
