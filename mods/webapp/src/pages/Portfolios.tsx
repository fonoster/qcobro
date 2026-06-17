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
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";
import { CsvSyncModal } from "../components/portfolios/CsvSyncModal.js";

function money(v: number, currency: string) {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency,
    minimumFractionDigits: 0
  }).format(v);
}

type Portfolio = {
  id: string;
  name: string;
  clientId: string;
  currency: string;
  accountCount: number;
  totalOutstandingBalance: number;
  recoveredAmount: number;
  status: string;
  createdAt: Date | string;
};

type StatusFilter = "" | "ACTIVE" | "PAUSED" | "ARCHIVED";

function statusBadgeVariant(status: string) {
  if (status === "ACTIVE") return "success";
  if (status === "PAUSED") return "orange";
  return "secondary";
}

export function Portfolios() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Portfolio | null>(null);
  const [syncing, setSyncing] = useState<Portfolio | null>(null);
  const [deleting, setDeleting] = useState<Portfolio | null>(null);

  const { data } = trpc.portfolios.list.useQuery(
    statusFilter ? { status: statusFilter } : undefined
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("portfolios.title")} description={t("portfolios.description")} />

      <DataTable
        data={portfolios}
        keyField="id"
        searchable={false}
        filterElement={
          <FilterSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="">{t("portfolios.filter.activeAndPaused")}</option>
            <option value="ACTIVE">{t("portfolios.filter.activeOnly")}</option>
            <option value="PAUSED">{t("portfolios.filter.pausedOnly")}</option>
            <option value="ARCHIVED">{t("portfolios.filter.archived")}</option>
          </FilterSelect>
        }
        actionLabel={t("portfolios.new")}
        onAction={() => setShowCreate(true)}
        onRowClick={(row) => navigate(`/portfolios/${row.id}`)}
        columns={[
          { key: "name", header: t("portfolios.col.name") },
          { key: "clientId", header: t("portfolios.col.clientId") },
          {
            key: "accountCount",
            header: t("portfolios.col.accounts"),
            render: (r) => r.accountCount.toLocaleString()
          },
          {
            key: "totalOutstandingBalance",
            header: t("portfolios.col.balance"),
            render: (r) => money(r.totalOutstandingBalance as number, r.currency as string)
          },
          {
            key: "recoveredAmount",
            header: t("portfolios.col.recovered"),
            render: (r) => money(r.recoveredAmount as number, r.currency as string)
          },
          {
            key: "status",
            header: t("portfolios.col.status"),
            render: (r) => (
              <Badge variant={statusBadgeVariant(r.status)}>
                {t(`portfolios.status.${r.status}` as Parameters<typeof t>[0])}
              </Badge>
            )
          },
          {
            key: "createdAt",
            header: t("portfolios.col.created"),
            render: (r) => new Date(r.createdAt).toLocaleDateString()
          },
          {
            key: "id",
            header: "",
            align: "center",
            render: (r) => (
              <RowActionsMenu
                items={[
                  { label: t("portfolios.actions.sync"), onClick: () => setSyncing(r) },
                  { label: t("portfolios.actions.edit"), onClick: () => setEditing(r) },
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
  const [currency, setCurrency] = useState<"USD" | "DOP">("USD");
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
    create.mutate({ name: name.trim(), clientId: clientId.trim(), currency });
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
        <SelectGroup
          label={t("portfolios.form.currency")}
          id="p-currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as "USD" | "DOP")}
        >
          <option value="USD">{t("portfolios.currency.USD")}</option>
          <option value="DOP">{t("portfolios.currency.DOP")}</option>
        </SelectGroup>
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
  const [status, setStatus] = useState(portfolio.status);

  const update = trpc.portfolios.update.useMutation({ onSuccess });

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("portfolios.form.editTitle")}
      confirmLabel={update.isPending ? "Guardando…" : t("portfolios.form.save")}
      onConfirm={() =>
        update.mutate({
          id: portfolio.id,
          name,
          status: status as "ACTIVE" | "PAUSED" | "ARCHIVED"
        })
      }
    >
      <div className="mt-4 flex flex-col gap-3">
        <InputGroup
          label={t("portfolios.form.name")}
          id="ep-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <SelectGroup
          label={t("portfolios.form.status")}
          id="ep-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ACTIVE">{t("portfolios.status.ACTIVE")}</option>
          <option value="PAUSED">{t("portfolios.status.PAUSED")}</option>
          <option value="ARCHIVED">{t("portfolios.status.ARCHIVED")}</option>
        </SelectGroup>
      </div>
    </Dialog>
  );
}
