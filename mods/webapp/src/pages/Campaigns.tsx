import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { PageHeader } from "../components/page-header.js";
import { BillingPausedNotice } from "../components/BillingPausedNotice.js";
import { DataTable } from "../components/ui/data-table.js";
import { Drawer } from "../components/ui/drawer.js";
import { Button } from "../components/ui/button.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { DayPicker } from "../components/ui/day-picker.js";
import { Field } from "../components/ui/field.js";
import { Megaphone, Plus } from "lucide-react";
import { ConfirmDeleteDialog } from "../components/ui/confirm-delete-dialog.js";
import { InputGroup } from "../components/ui/input.js";
import { SelectGroup, FilterSelect } from "../components/ui/select.js";
import { Badge } from "../components/ui/badge.js";
import { RowActionsMenu, type RowAction } from "../components/ui/row-actions-menu.js";
import { humanizeDays } from "../lib/campaignDays.js";

type CampaignStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  pauseReason: "MANUAL" | "AUTO_ERROR_THRESHOLD" | null;
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
      <PageHeader
        title={t("campaigns.title")}
        description={t("campaigns.description")}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t("campaigns.new")}
          </Button>
        }
      />

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
        rowHeight={64}
        onRowClick={(row) => navigate(`/campaigns/${row.id}`)}
        empty={
          statusFilter ? undefined : (
            <EmptyState
              icon={<Megaphone />}
              title={t("campaigns.empty.title")}
              body={t("campaigns.empty.body")}
              action={
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" />
                  {t("campaigns.empty.cta")}
                </Button>
              }
            />
          )
        }
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
            mono: true,
            render: (r) => `${r.startTime}–${r.endTime}`
          },
          {
            key: "status",
            header: t("campaigns.col.status"),
            render: (r) => (
              <div className="flex flex-col items-start gap-1">
                <Badge variant="secondary">
                  {t(`campaigns.status.${r.status}` as Parameters<typeof t>[0])}
                </Badge>
                {r.pauseReason === "AUTO_ERROR_THRESHOLD" && (
                  <span className="text-xs text-warning">
                    {t("campaigns.list.autopausedReason")}
                  </span>
                )}
              </div>
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

  function handleSave() {
    if (!name.trim()) return setError(t("campaigns.form.noName"));
    if (daysOfWeek.length === 0) return setError(t("campaigns.form.noDays"));
    if (startTime >= endTime) return setError(t("campaigns.form.invalidWindow"));
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
    <Drawer
      open
      onClose={onClose}
      width={560}
      title={t("campaigns.form.editTitle")}
      subtitle={t("campaigns.form.editSubtitle")}
      confirmLabel={update.isPending ? t("common.saving") : t("campaigns.form.save")}
      confirmDisabled={update.isPending}
      onSubmit={handleSave}
      error={error}
    >
      <div className="flex flex-col gap-4">
        <InputGroup
          label={t("campaigns.form.name")}
          id="e-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Field label={t("campaigns.form.days")}>
          <DayPicker
            aria-label={t("campaigns.form.days")}
            value={daysOfWeek}
            onChange={setDaysOfWeek}
          />
        </Field>

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
      </div>
    </Drawer>
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
  const [maxPerDay, setMaxPerDay] = useState(1);
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

  function handleCreate() {
    if (!name.trim()) return setError(t("campaigns.form.noName"));
    if (portfolioIds.length === 0) return setError(t("campaigns.form.noPortfolios"));
    if (!agentTemplateId) return setError(t("campaigns.form.noAgents"));
    if (!startDate) return setError(t("campaigns.form.noStartDate"));
    if (daysOfWeek.length === 0) return setError(t("campaigns.form.noDays"));
    if (startTime >= endTime) return setError(t("campaigns.form.invalidWindow"));
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
    <Drawer
      open
      onClose={onClose}
      width={560}
      title={t("campaigns.new")}
      subtitle={t("campaigns.form.createSubtitle")}
      confirmLabel={create.isPending ? t("common.creating") : t("campaigns.form.create")}
      confirmDisabled={create.isPending}
      onSubmit={handleCreate}
      error={error}
    >
      <div className="flex flex-col gap-4">
        <InputGroup
          label={t("campaigns.form.name")}
          id="c-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Field label={t("campaigns.form.portfolios")}>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-control border border-input bg-bg p-2">
            {(portfolios.data ?? []).map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-fg hover:bg-elevated"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={portfolioIds.includes(p.id)}
                  onChange={() => togglePortfolio(p.id)}
                />
                {p.name}
              </label>
            ))}
          </div>
        </Field>

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
          <p className="text-xs text-fg-muted">{t("campaigns.form.noWhatsAppSender")}</p>
        )}

        <Field label={t("campaigns.form.days")}>
          <DayPicker
            aria-label={t("campaigns.form.days")}
            value={daysOfWeek}
            onChange={setDaysOfWeek}
          />
        </Field>

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
      </div>
    </Drawer>
  );
}
