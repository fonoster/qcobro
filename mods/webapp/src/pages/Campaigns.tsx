import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { PageHeader } from "../components/page-header.js";
import { BillingPausedNotice } from "../components/BillingPausedNotice.js";
import { DataTable, TableCellStack } from "../components/ui/data-table.js";
import { Button } from "../components/ui/button.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { FilterChip } from "../components/ui/filter-chip.js";
import { SearchBox } from "../components/ui/input.js";
import { Megaphone, Plus } from "lucide-react";
import { ConfirmDeleteDialog } from "../components/ui/confirm-delete-dialog.js";
import { Badge } from "../components/ui/badge.js";
import { RowActionsMenu, type RowAction } from "../components/ui/row-actions-menu.js";
import { channelIcon } from "../lib/channelIcon.js";
import { useWorkspaceTimezone } from "../lib/useWorkspaceCurrency.js";
import { formatNextRun, nextRun } from "../lib/campaignSchedule.js";
import {
  CreateCampaignDrawer,
  EditCampaignDrawer,
  agentLabel
} from "../components/campaigns/CampaignFormDrawer.js";
import { Switch } from "../components/ui/switch.js";

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

const STATUS_FILTERS: CampaignStatus[] = ["ACTIVE", "PAUSED", "COMPLETED"];
const CHANNELS = ["VOICE_AI", "VOICE_PRERECORDED", "SMS", "EMAIL", "WHATSAPP"] as const;
const PAGE_SIZE = 10;

export function Campaigns() {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const timeZone = useWorkspaceTimezone();

  const [statusFilter, setStatusFilter] = useState<"" | CampaignStatus>("");
  const [channelFilter, setChannelFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);

  const [includeArchived, setIncludeArchived] = useState(false);
  const { data } = trpc.campaigns.list.useQuery(
    statusFilter ? { status: statusFilter } : undefined
  );
  // The API leaves archived campaigns out unless asked for them by status, so "Mostrar
  // archivadas" fetches them separately and appends them to the unfiltered list.
  const archived = trpc.campaigns.list.useQuery(
    { status: "ARCHIVED" },
    { enabled: includeArchived && !statusFilter }
  );
  const campaigns: Campaign[] = [
    ...((data ?? []) as Campaign[]),
    ...(includeArchived && !statusFilter ? ((archived.data ?? []) as Campaign[]) : [])
  ];

  // Search and the channel filter are client-side; the status filter is the API's.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter(
      (c) =>
        (!channelFilter || c.agentTemplate?.type === channelFilter) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          (c.agentTemplate?.name ?? "").toLowerCase().includes(q))
    );
  }, [campaigns, channelFilter, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtering = Boolean(statusFilter || channelFilter || search || includeArchived);

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

  const all = t("campaigns.filter.all");

  return (
    <div className="flex flex-col gap-5">
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
        data={pageRows}
        keyField="id"
        filterElement={
          <SearchBox
            placeholder={t("campaigns.search")}
            aria-label={t("campaigns.search")}
            className="w-80"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        }
        filters={
          <>
            <FilterChip
              label={t("campaigns.filter.channel")}
              value={channelFilter}
              onChange={(v) => {
                setChannelFilter(v);
                setPage(1);
              }}
              options={[
                { value: "", label: all },
                ...CHANNELS.map((c) => ({
                  value: c,
                  label: t(`agents.type.${c}` as Parameters<typeof t>[0])
                }))
              ]}
            />
            <FilterChip
              label={t("campaigns.filter.status")}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v as "" | CampaignStatus);
                setPage(1);
              }}
              options={[
                { value: "", label: all },
                ...STATUS_FILTERS.map((s) => ({
                  value: s,
                  label: t(`campaigns.filter.${s}` as Parameters<typeof t>[0])
                }))
              ]}
            />
            <div className="pl-1">
              <Switch
                id="campaigns-show-archived"
                label={t("campaigns.filter.showArchived")}
                checked={includeArchived}
                onChange={(e) => {
                  setIncludeArchived(e.target.checked);
                  setPage(1);
                }}
              />
            </div>
          </>
        }
        countLabel={t("campaigns.items")}
        rowHeight={64}
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalRecords={filtered.length}
        pageSize={PAGE_SIZE}
        itemLabel={t("campaigns.items")}
        onRowClick={(row) => navigate(`/campaigns/${row.id}`)}
        empty={
          filtering ? undefined : (
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
          {
            key: "name",
            header: t("campaigns.col.name"),
            render: (r) => <TableCellStack title={r.name} />
          },
          {
            key: "status",
            header: t("campaigns.col.status"),
            width: 150,
            render: (r) => (
              <div className="flex flex-col items-start gap-1">
                <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-xs">
                  {t(`campaigns.status.${r.status}` as Parameters<typeof t>[0])}
                </Badge>
                {r.pauseReason === "AUTO_ERROR_THRESHOLD" && (
                  <span className="text-[11px] text-fg-muted">
                    {t("campaigns.list.autopausedReason")}
                  </span>
                )}
              </div>
            )
          },
          {
            key: "channel",
            header: t("campaigns.col.channel"),
            width: 160,
            render: (r) => {
              if (!r.agentTemplate) return <span className="text-fg-muted">—</span>;
              const Icon = channelIcon(r.agentTemplate.type);
              return (
                <span className="inline-flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-fg-muted" />
                  {t(`agents.type.${r.agentTemplate.type}` as Parameters<typeof t>[0])}
                </span>
              );
            }
          },
          {
            key: "agentTemplate",
            header: t("campaigns.col.agent"),
            width: 220,
            render: (r) => <span className="text-fg-muted">{agentLabel(r.agentTemplate, t)}</span>
          },
          {
            key: "nextRun",
            header: t("campaigns.col.nextRun"),
            width: 190,
            mono: true,
            className: "whitespace-nowrap",
            render: (r) => {
              const run = timeZone ? nextRun(r, timeZone) : null;
              return run ? (
                formatNextRun(run, t, language)
              ) : (
                <span className="text-fg-muted">—</span>
              );
            }
          },
          {
            key: "id",
            header: "",
            align: "right",
            width: 56,
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
        <CreateCampaignDrawer
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            invalidate();
          }}
        />
      )}

      {editing && (
        <EditCampaignDrawer
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
