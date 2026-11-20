import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { recoveryPeriodRange } from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { useMoney, useWorkspaceTimezone } from "../lib/useWorkspaceCurrency.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable } from "../components/ui/data-table.js";
import { Dialog } from "../components/ui/dialog.js";
import { ConfirmDeleteDialog } from "../components/ui/confirm-delete-dialog.js";
import { InputGroup } from "../components/ui/input.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { FolderOpen, Plus } from "lucide-react";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";
import { CsvSyncModal } from "../components/portfolios/CsvSyncModal.js";

function lastSynced(v: Date | string | null, language: string, never: string) {
  if (!v) return never;
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "numeric"
  }).format(new Date(v));
}

type Portfolio = {
  id: string;
  name: string;
  clientId: string;
  accountCount: number;
  totalOutstandingBalance: number;
  lastSyncedAt: Date | string | null;
  archivedAt: Date | string | null;
  createdAt: Date | string;
};

export function Portfolios() {
  const { t, language } = useI18n();
  const money = useMoney();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Portfolio | null>(null);
  const [syncing, setSyncing] = useState<Portfolio | null>(null);
  const [deleting, setDeleting] = useState<Portfolio | null>(null);

  const { data } = trpc.portfolios.list.useQuery(
    includeArchived ? { includeArchived: true } : undefined
  );
  const portfolios: Portfolio[] = (data ?? []) as Portfolio[];

  // Recuperado · este mes: each portfolio's recoveries detected since the 1st, in the
  // workspace's timezone.
  const timeZone = useWorkspaceTimezone();
  const thisMonth = timeZone ? recoveryPeriodRange("thisMonth", timeZone) : undefined;
  const recoveries = trpc.useQueries((q) =>
    thisMonth ? portfolios.map((p) => q.recovery.summary({ ...thisMonth, portfolioId: p.id })) : []
  );
  const recoveredThisMonth = new Map(
    portfolios.map((p, i) => [p.id, recoveries[i]?.data?.recovered])
  );

  function invalidate() {
    utils.portfolios.list.invalidate();
    // A sync can detect recoveries, so this month's column refetches with the list.
    utils.recovery.summary.invalidate();
  }

  const del = trpc.portfolios.delete.useMutation({
    onSuccess: () => {
      setDeleting(null);
      invalidate();
    }
  });

  const setArchived = trpc.portfolios.update.useMutation({ onSuccess: invalidate });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("portfolios.title")}
        description={t("portfolios.description")}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t("portfolios.new")}
          </Button>
        }
      />

      <DataTable
        data={portfolios}
        keyField="id"
        searchable={false}
        filterElement={
          <label className="flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            {t("portfolios.filter.showArchived")}
          </label>
        }
        rowHeight={60}
        onRowClick={(row) => navigate(`/portfolios/${row.id}`)}
        empty={
          includeArchived ? undefined : (
            <EmptyState
              icon={<FolderOpen />}
              title={t("portfolios.empty.title")}
              body={t("portfolios.empty.body")}
              action={
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" />
                  {t("portfolios.new")}
                </Button>
              }
            />
          )
        }
        columns={[
          {
            key: "name",
            header: t("portfolios.col.name"),
            render: (r) =>
              r.archivedAt ? (
                <span className="inline-flex items-center gap-2">
                  {r.name}
                  <Badge variant="secondary">{t("portfolios.archivedBadge")}</Badge>
                </span>
              ) : (
                r.name
              )
          },
          { key: "clientId", header: t("portfolios.col.clientId"), mono: true },
          {
            key: "accountCount",
            header: t("portfolios.col.accounts"),
            mono: true,
            render: (r) => r.accountCount.toLocaleString()
          },
          {
            key: "totalOutstandingBalance",
            header: t("portfolios.col.balance"),
            mono: true,
            render: (r) => money(r.totalOutstandingBalance as number)
          },
          {
            key: "recoveredThisMonth",
            header: t("portfolios.col.recovered"),
            mono: true,
            render: (r) => {
              const recovered = recoveredThisMonth.get(r.id);
              return recovered === undefined ? "" : money(recovered);
            }
          },
          {
            key: "lastSyncedAt",
            header: t("portfolios.col.lastSynced"),
            render: (r) => lastSynced(r.lastSyncedAt, language, t("portfolios.lastSynced.never"))
          },
          {
            key: "id",
            header: "",
            align: "right",
            className: "w-px whitespace-nowrap",
            render: (r) => (
              <RowActionsMenu
                items={[
                  { label: t("portfolios.actions.sync"), onClick: () => setSyncing(r) },
                  { label: t("portfolios.actions.edit"), onClick: () => setEditing(r) },
                  r.archivedAt
                    ? {
                        label: t("portfolios.actions.restore"),
                        onClick: () => setArchived.mutate({ id: r.id, archived: false })
                      }
                    : {
                        label: t("portfolios.actions.archive"),
                        onClick: () => setArchived.mutate({ id: r.id, archived: true })
                      },
                  {
                    label: t("portfolios.actions.delete"),
                    onClick: () => setDeleting(r),
                    variant: "destructive"
                  }
                ]}
              />
            )
          }
        ]}
      />

      {showCreate && (
        <CreatePortfolioModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            invalidate();
          }}
        />
      )}

      {editing && (
        <EditPortfolioModal
          portfolio={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}

      {syncing && (
        <CsvSyncModal
          portfolio={syncing}
          onClose={() => setSyncing(null)}
          onSuccess={() => {
            setSyncing(null);
            invalidate();
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate({ id: deleting.id })}
        isPending={del.isPending}
        title={`${t("portfolios.delete.title")} "${deleting?.name ?? ""}"`}
        description={t("portfolios.delete.description")}
      />
    </div>
  );
}

function CreatePortfolioModal({
  onClose,
  onSuccess
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [clientIdError, setClientIdError] = useState<string | null>(null);

  const create = trpc.portfolios.create.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function handleCreate() {
    const nameMissing = !name.trim();
    const clientIdMissing = !clientId.trim();
    setNameError(nameMissing ? t("portfolios.form.nameRequired") : null);
    setClientIdError(clientIdMissing ? t("portfolios.form.clientIdRequired") : null);
    if (nameMissing || clientIdMissing) return;
    setError(null);
    create.mutate({ name: name.trim(), clientId: clientId.trim() });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("portfolios.new")}
      confirmLabel={create.isPending ? t("common.creating") : t("portfolios.form.create")}
      confirmDisabled={create.isPending}
      onSubmit={handleCreate}
      error={error}
    >
      <InputGroup
        label={t("portfolios.form.name")}
        id="p-name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setNameError(null);
        }}
        error={nameError ?? undefined}
        placeholder="Bancolombia Q3 2026"
      />
      <InputGroup
        label={t("portfolios.form.clientId")}
        id="p-client"
        value={clientId}
        onChange={(e) => {
          setClientId(e.target.value);
          setClientIdError(null);
        }}
        error={clientIdError ?? undefined}
        placeholder="bancolombia"
      />
      <p className="text-xs text-fg-muted">{t("portfolios.form.csvNote")}</p>
    </Dialog>
  );
}

function EditPortfolioModal({
  portfolio,
  onClose,
  onSuccess
}: {
  portfolio: Portfolio;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(portfolio.name);

  const update = trpc.portfolios.update.useMutation({ onSuccess });

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("portfolios.form.editTitle")}
      confirmLabel={update.isPending ? t("common.saving") : t("portfolios.form.save")}
      confirmDisabled={update.isPending}
      onSubmit={() => update.mutate({ id: portfolio.id, name })}
    >
      <InputGroup
        label={t("portfolios.form.name")}
        id="ep-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
    </Dialog>
  );
}
