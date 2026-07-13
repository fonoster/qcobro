import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { useWorkspaceCurrency } from "../lib/useWorkspaceCurrency.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable } from "../components/ui/data-table.js";
import { Dialog } from "../components/ui/dialog.js";
import { ConfirmDeleteDialog } from "../components/ui/confirm-delete-dialog.js";
import { InputGroup } from "../components/ui/input.js";
import { Badge } from "../components/ui/badge.js";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";
import { CsvSyncModal } from "../components/portfolios/CsvSyncModal.js";

function money(v: number, currency: string) {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency,
    minimumFractionDigits: 0
  }).format(v);
}

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
  recoveredAmount: number;
  lastSyncedAt: Date | string | null;
  archivedAt: Date | string | null;
  createdAt: Date | string;
};

export function Portfolios() {
  const { t, language } = useI18n();
  const wsCurrency = useWorkspaceCurrency();
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

  function invalidate() {
    utils.portfolios.list.invalidate();
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
      <PageHeader title={t("portfolios.title")} description={t("portfolios.description")} />

      <DataTable
        data={portfolios}
        keyField="id"
        searchable={false}
        filterElement={
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            {t("portfolios.filter.showArchived")}
          </label>
        }
        actionLabel={t("portfolios.new")}
        onAction={() => setShowCreate(true)}
        onRowClick={(row) => navigate(`/portfolios/${row.id}`)}
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
          { key: "clientId", header: t("portfolios.col.clientId") },
          {
            key: "accountCount",
            header: t("portfolios.col.accounts"),
            render: (r) => r.accountCount.toLocaleString()
          },
          {
            key: "totalOutstandingBalance",
            header: t("portfolios.col.balance"),
            render: (r) => money(r.totalOutstandingBalance as number, wsCurrency)
          },
          {
            key: "recoveredAmount",
            header: t("portfolios.col.recovered"),
            render: (r) => money(r.recoveredAmount as number, wsCurrency)
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

  const create = trpc.portfolios.create.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function handleCreate() {
    if (!name.trim()) {
      setError("El nombre es requerido.");
      return;
    }
    if (!clientId.trim()) {
      setError("El ID del cliente es requerido.");
      return;
    }
    setError(null);
    create.mutate({ name: name.trim(), clientId: clientId.trim() });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("portfolios.new")}
      confirmLabel={create.isPending ? "Creando…" : t("portfolios.form.create")}
      onConfirm={handleCreate}
    >
      <div className="mt-4 flex flex-col gap-3">
        <InputGroup
          label={t("portfolios.form.name")}
          id="p-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ej. Bancolombia Q2 2025"
        />
        <InputGroup
          label={t("portfolios.form.clientId")}
          id="p-client"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="ej. bancolombia"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-xs text-slate-400">{t("portfolios.form.csvNote")}</p>
      </div>
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
      confirmLabel={update.isPending ? "Guardando…" : t("portfolios.form.save")}
      onConfirm={() => update.mutate({ id: portfolio.id, name })}
    >
      <div className="mt-4 flex flex-col gap-3">
        <InputGroup
          label={t("portfolios.form.name")}
          id="ep-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
    </Dialog>
  );
}
