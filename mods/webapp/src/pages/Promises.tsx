import { useState } from "react";
import { trpc } from "@/lib/trpc.js";
import { t } from "@/lib/i18n.js";
import { formatMoney, formatDate } from "@qcobro/common";
import { PageHeader } from "@/components/page-header.js";
import { DataTable } from "@/components/ui/data-table.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Dialog } from "@/components/ui/dialog.js";
import { InputGroup } from "@/components/ui/input.js";
import { FilterBar } from "@/components/filter-bar.js";

const STATUS_VARIANTS = {
  PENDING: "orange",
  FULFILLED: "success",
  OVERDUE: "destructive",
  CANCELLED: "secondary"
} as const;

export function Promises() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, refetch } = trpc.promises.list.useQuery({
    status: statusFilter as "PENDING" | "FULFILLED" | "OVERDUE" | "CANCELLED" | undefined || undefined,
    limit,
    offset: (page - 1) * limit
  });
  const markOverdue = trpc.promises.markOverdue.useMutation({ onSuccess: () => refetch() });

  const promises = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.promises.title}
        description={t.promises.description}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => markOverdue.mutate()} disabled={markOverdue.isPending}>
              {t.promises.markOverdue}
            </Button>
            <Button onClick={() => setShowCreate(true)}>+ {t.promises.newPromise}</Button>
          </div>
        }
      />

      <FilterBar
        searchPlaceholder="Buscar por cuenta…"
        filters={[{
          label: "Estado",
          options: [
            { value: "", label: "Todos los estados" },
            { value: "PENDING", label: t.common.status.PENDING },
            { value: "FULFILLED", label: t.common.status.FULFILLED },
            { value: "OVERDUE", label: t.common.status.OVERDUE },
            { value: "CANCELLED", label: t.common.status.CANCELLED }
          ],
          onChange: (v) => { setStatusFilter(v); setPage(1); }
        }]}
      />

      <DataTable
        data={promises}
        keyField="id"
        searchable={false}
        page={page}
        totalPages={Math.ceil(total / limit)}
        totalRecords={total}
        onPageChange={setPage}
        columns={[
          { key: "accountId", header: t.promises.columns.account },
          {
            key: "campaign",
            header: t.promises.columns.campaign,
            render: (r) => (r as any).activity?.campaign?.name ?? "—"
          },
          {
            key: "amount",
            header: t.promises.columns.amount,
            render: (r) => formatMoney(r.amount)
          },
          {
            key: "dueDate",
            header: t.promises.columns.dueDate,
            render: (r) => formatDate(r.dueDate)
          },
          {
            key: "status",
            header: t.promises.columns.status,
            render: (r) => (
              <Badge variant={STATUS_VARIANTS[r.status as keyof typeof STATUS_VARIANTS] ?? "secondary"}>
                {t.common.status[r.status as keyof typeof t.common.status] ?? r.status}
              </Badge>
            )
          },
          {
            key: "id",
            header: t.common.actions,
            render: (r) => (
              <PromiseActions id={r.id} status={r.status} onSuccess={refetch} />
            )
          }
        ]}
      />

      <CreatePromiseModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); refetch(); }}
      />
    </div>
  );
}

function PromiseActions({ id, status, onSuccess }: { id: string; status: string; onSuccess: () => void }) {
  const update = trpc.promises.updateStatus.useMutation({ onSuccess });
  if (status !== "PENDING") return null;
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" onClick={() => update.mutate({ id, status: "FULFILLED" })}>
        {t.promises.actions.fulfilled}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => update.mutate({ id, status: "CANCELLED" })}>
        {t.promises.actions.cancel}
      </Button>
    </div>
  );
}

function CreatePromiseModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [activityId, setActivityId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const create = trpc.promises.create.useMutation({ onSuccess });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.promises.newPromise}
      description="Registrar un compromiso de pago"
      confirmLabel={create.isPending ? "Creando…" : t.common.create}
      onConfirm={() => create.mutate({
        activityId,
        accountId,
        amount: parseFloat(amount),
        dueDate: new Date(dueDate).toISOString()
      })}
    >
      <div className="mt-4 flex flex-col gap-3">
        <InputGroup label="ID de gestión" id="pr-activity" value={activityId} onChange={(e) => setActivityId(e.target.value)} placeholder="Referencia de gestión" />
        <InputGroup label="Cuenta ID" id="pr-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="ej. ACC-001" />
        <InputGroup label="Monto" id="pr-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        <InputGroup label="Fecha de vencimiento" id="pr-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
    </Dialog>
  );
}
