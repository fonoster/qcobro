import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { recoveryPeriodRange } from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { useMoney, useWorkspaceTimezone } from "../lib/useWorkspaceCurrency.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable, TableCellStack, TableCount } from "../components/ui/data-table.js";
import { Dialog } from "../components/ui/dialog.js";
import { ConfirmDeleteDialog } from "../components/ui/confirm-delete-dialog.js";
import { InputGroup, SearchBox } from "../components/ui/input.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { FolderOpen, Plus } from "lucide-react";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";
import { CsvSyncModal } from "../components/portfolios/CsvSyncModal.js";
import { InfoNote } from "../components/portfolios/InfoNote.js";
import { formatRelativeDate } from "../lib/relativeDate.js";
import { Switch } from "../components/ui/switch.js";

const PAGE_SIZE = 20;

function absoluteDate(v: Date | string, language: string) {
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
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data } = trpc.portfolios.list.useQuery(
    includeArchived ? { includeArchived: true } : undefined
  );
  const portfolios: Portfolio[] = (data ?? []) as Portfolio[];

  // Search and paginate here (the list is one unpaginated query): the toolbar count and the
  // "Mostrando a–b de N" line both follow the search.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return portfolios;
    return portfolios.filter(
      (p) => p.name.toLowerCase().includes(q) || p.clientId.toLowerCase().includes(q)
    );
  }, [portfolios, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const countText = t(`portfolios.count.${filtered.length === 1 ? "one" : "other"}`).replace(
    "{count}",
    filtered.length.toLocaleString()
  );
  // Nothing to search or filter yet: the empty state stands alone, without the toolbar.
  const noPortfolios = data !== undefined && portfolios.length === 0 && !includeArchived;

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
        data={pageRows}
        keyField="id"
        searchable={false}
        filterElement={
          noPortfolios ? undefined : (
            <div className="flex items-center gap-4">
              <SearchBox
                placeholder={t("portfolios.searchPlaceholder")}
                aria-label={t("portfolios.searchPlaceholder")}
                className="w-80"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              <div className="pl-1">
                <Switch
                  id="portfolios-show-archived"
                  label={t("portfolios.filter.showArchived")}
                  checked={includeArchived}
                  onChange={(e) => {
                    setIncludeArchived(e.target.checked);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          )
        }
        toolbarEnd={noPortfolios ? undefined : <TableCount>{countText}</TableCount>}
        rowHeight={60}
        onRowClick={(row) => navigate(`/portfolios/${row.id}`)}
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalRecords={data === undefined ? undefined : filtered.length}
        pageSize={PAGE_SIZE}
        itemLabel={t("portfolios.itemLabel")}
        empty={
          !noPortfolios ? undefined : (
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
            render: (r) => (
              <TableCellStack
                title={
                  r.archivedAt ? (
                    <span className="inline-flex items-center gap-2">
                      {r.name}
                      <Badge variant="secondary">{t("portfolios.archivedBadge")}</Badge>
                    </span>
                  ) : (
                    r.name
                  )
                }
                sub={r.clientId}
              />
            )
          },
          {
            key: "accountCount",
            header: t("portfolios.col.accounts"),
            mono: true,
            width: 110,
            render: (r) => r.accountCount.toLocaleString()
          },
          {
            key: "totalOutstandingBalance",
            header: t("portfolios.col.balance"),
            mono: true,
            width: 160,
            render: (r) => money(r.totalOutstandingBalance as number)
          },
          {
            key: "recoveredThisMonth",
            header: t("portfolios.col.recovered"),
            mono: true,
            width: 160,
            render: (r) => {
              const recovered = recoveredThisMonth.get(r.id);
              return recovered === undefined ? "" : money(recovered);
            }
          },
          {
            key: "lastSyncedAt",
            header: t("portfolios.col.lastSynced"),
            width: 170,
            render: (r) =>
              r.lastSyncedAt ? (
                <span
                  className="whitespace-nowrap text-fg-muted"
                  title={absoluteDate(r.lastSyncedAt, language)}
                >
                  {formatRelativeDate(r.lastSyncedAt, language)}
                </span>
              ) : (
                <span className="whitespace-nowrap text-fg-muted">
                  {t("portfolios.lastSynced.never")}
                </span>
              )
          },
          {
            key: "id",
            header: "",
            align: "right",
            width: 40,
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
      subtitle={t("portfolios.newSubtitle")}
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
        className="[&_input]:font-mono"
      />
      <InfoNote>{t("portfolios.form.csvNote")}</InfoNote>
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
