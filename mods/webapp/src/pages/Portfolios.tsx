import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc.js";
import { t } from "@/lib/i18n.js";
import { parseCsv } from "@/lib/csv.js";
import { formatMoney, formatDate } from "@qcobro/common";
import { PageHeader } from "@/components/page-header.js";
import { DataTable } from "@/components/ui/data-table.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Dialog } from "@/components/ui/dialog.js";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog.js";
import { InputGroup } from "@/components/ui/input.js";
import { SelectGroup } from "@/components/ui/select.js";
import { FilterBar } from "@/components/filter-bar.js";

type StatusFilter = "ACTIVE" | "CLOSED" | "";
type SyncMode = "APPEND_ONLY" | "UPDATE_EXISTING" | "REPLACE";

const SYNC_MODES: { value: SyncMode; label: string; description: string }[] = [
  {
    value: "APPEND_ONLY",
    label: "Solo agregar nuevas",
    description: "Agrega cuentas nuevas. No modifica ni elimina las existentes."
  },
  {
    value: "UPDATE_EXISTING",
    label: "Agregar y actualizar",
    description: "Agrega cuentas nuevas y actualiza los campos de las existentes."
  },
  {
    value: "REPLACE",
    label: "Reemplazar todo",
    description: "Agrega nuevas, actualiza existentes y elimina las que no estén en el CSV."
  }
];

export function Portfolios() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const { data, refetch } = trpc.portfolios.list.useQuery(
    statusFilter ? { status: statusFilter as "ACTIVE" | "CLOSED" } : undefined
  );

  const portfolios = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.portfolios.title}
        description={t.portfolios.description}
        action={<Button onClick={() => setShowCreate(true)}>+ {t.portfolios.newPortfolio}</Button>}
      />

      <FilterBar
        searchPlaceholder="Buscar carteras…"
        filters={[{
          label: "Estado",
          options: [
            { value: "", label: "Todos los estados" },
            { value: "ACTIVE", label: t.common.status.ACTIVE },
            { value: "CLOSED", label: t.common.status.CLOSED }
          ],
          onChange: (v) => setStatusFilter(v as StatusFilter)
        }]}
      />

      <DataTable
        data={portfolios}
        keyField="id"
        searchable={false}
        columns={[
          { key: "name", header: t.portfolios.columns.name },
          { key: "clientId", header: t.portfolios.columns.clientId },
          {
            key: "accounts",
            header: t.portfolios.columns.accounts,
            render: (r) => r.accounts.toLocaleString()
          },
          {
            key: "totalAmount",
            header: t.portfolios.columns.totalAmount,
            render: (r) => formatMoney(r.totalAmount)
          },
          {
            key: "recoveredAmount",
            header: t.portfolios.columns.recoveredAmount,
            render: (r) => formatMoney(r.recoveredAmount)
          },
          {
            key: "status",
            header: t.portfolios.columns.status,
            render: (r) => (
              <Badge variant={r.status === "ACTIVE" ? "success" : "secondary"}>
                {r.status === "ACTIVE" ? t.common.status.ACTIVE : t.common.status.CLOSED}
              </Badge>
            )
          },
          {
            key: "createdAt",
            header: "Creado",
            render: (r) => formatDate(r.createdAt)
          },
          {
            key: "id",
            header: "",
            render: (r) => (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setSyncing(r.id)}>
                  Importar CSV
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(r.id)}>
                  {t.common.edit}
                </Button>
              </div>
            )
          }
        ]}
      />

      <CreatePortfolioModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); refetch(); }}
      />

      {editing && (
        <EditPortfolioModal
          id={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); refetch(); }}
        />
      )}

      {syncing && (
        <CsvSyncModal
          portfolioId={syncing}
          portfolioName={portfolios.find((p) => p.id === syncing)?.name ?? ""}
          onClose={() => setSyncing(null)}
          onSuccess={() => { setSyncing(null); refetch(); }}
        />
      )}
    </div>
  );
}

function CreatePortfolioModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [accounts, setAccounts] = useState("");

  const create = trpc.portfolios.create.useMutation({ onSuccess });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.portfolios.newPortfolio}
      description="Crear un nuevo portfolio de deudas"
      confirmLabel={create.isPending ? "Creando…" : t.portfolios.form.create}
      onConfirm={() => create.mutate({
        name,
        clientId,
        totalAmount: parseFloat(totalAmount) || 0,
        accounts: parseInt(accounts) || 0
      })}
    >
      <div className="mt-4 flex flex-col gap-3">
        <InputGroup label={t.portfolios.form.name} id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Bancolombia Q2 2024" />
        <InputGroup label={t.portfolios.form.clientId} id="p-client" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="ej. cliente-bancolombia" />
        <InputGroup label={t.portfolios.form.totalAmount} id="p-amount" type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0.00" />
        <InputGroup label={t.portfolios.form.accounts} id="p-accounts" type="number" value={accounts} onChange={(e) => setAccounts(e.target.value)} placeholder="0" />
      </div>
    </Dialog>
  );
}

function EditPortfolioModal({ id, onClose, onSuccess }: { id: string; onClose: () => void; onSuccess: () => void }) {
  const { data } = trpc.portfolios.get.useQuery({ id });
  const [name, setName] = useState(data?.name ?? "");
  const [status, setStatus] = useState(data?.status ?? "ACTIVE");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const update = trpc.portfolios.update.useMutation({ onSuccess });
  const del = trpc.portfolios.delete.useMutation({ onSuccess });

  if (!data) return null;

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={t.portfolios.editPortfolio}
        confirmLabel={update.isPending ? "Guardando…" : t.portfolios.form.save}
        onConfirm={() => update.mutate({ id, name: name || data.name, status: status as "ACTIVE" | "CLOSED" })}
      >
        <div className="mt-4 flex flex-col gap-3">
          <InputGroup label={t.portfolios.form.name} id="ep-name" value={name || data.name} onChange={(e) => setName(e.target.value)} />
          <SelectGroup label={t.portfolios.columns.status} id="ep-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">{t.common.status.ACTIVE}</option>
            <option value="CLOSED">{t.common.status.CLOSED}</option>
          </SelectGroup>
          <Button variant="destructive" size="sm" onClick={() => setShowConfirmDelete(true)}>
            {t.portfolios.form.delete}
          </Button>
        </div>
      </Dialog>

      <ConfirmDeleteDialog
        open={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={() => del.mutate({ id })}
        isPending={del.isPending}
        title={`Eliminar cartera "${data.name}"`}
        description="Esta acción eliminará permanentemente la cartera, todas sus campañas, gestiones y promesas asociadas. No se puede deshacer."
      />
    </>
  );
}

function CsvSyncModal({ portfolioId, portfolioName, onClose, onSuccess }: {
  portfolioId: string;
  portfolioName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<SyncMode>("APPEND_ONLY");
  const [rows, setRows] = useState<ReturnType<typeof parseCsv>["rows"]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ created: number; updated: number; deleted: number; total: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sync = trpc.portfolios.syncAccounts.useMutation({
    onSuccess: (data) => { setResult(data); setSyncError(null); },
    onError: (err) => setSyncError(err.message)
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setSyncError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed.rows);
      setParseErrors(parsed.errors);
    };
    reader.readAsText(file);
  }

  function handleSync() {
    if (rows.length === 0) return;
    sync.mutate({ portfolioId, mode, rows });
  }

  const canSync = rows.length > 0 && parseErrors.length === 0 && !sync.isPending && !result;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Importar cuentas — ${portfolioName}`}
      description="Sincronizar cuentas desde un archivo CSV"
      confirmLabel={result ? "Cerrar" : sync.isPending ? "Importando…" : `Importar ${rows.length} cuentas`}
      onConfirm={result ? onSuccess : canSync ? handleSync : undefined}
    >
      <div className="mt-4 flex flex-col gap-4">
        {!result ? (
          <>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-700">Formato del CSV</p>
              <div className="rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
                accountId,name,amount,phone,email
              </div>
              <p className="mt-1 text-xs text-slate-400">Las columnas <strong>accountId</strong>, <strong>name</strong> y <strong>amount</strong> son requeridas.</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-slate-700">Archivo CSV</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Seleccionar archivo
                </Button>
                <span className="text-sm text-slate-500">{fileName || "Ningún archivo seleccionado"}</span>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </div>

            {parseErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="mb-1 text-xs font-medium text-red-700">Errores en el archivo:</p>
                {parseErrors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}

            {syncError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="mb-1 text-xs font-medium text-red-700">Error al importar:</p>
                <p className="text-xs text-red-600">{syncError}</p>
              </div>
            )}

            {rows.length > 0 && (
              <p className="text-sm text-emerald-700">{rows.length} cuentas listas para importar.</p>
            )}

            <div>
              <p className="mb-2 text-xs font-medium text-slate-700">Modo de sincronización</p>
              <div className="flex flex-col gap-2">
                {SYNC_MODES.map((m) => (
                  <label key={m.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50">
                    <input
                      type="radio"
                      name="syncMode"
                      value={m.value}
                      checked={mode === m.value}
                      onChange={() => setMode(m.value)}
                      className="mt-0.5 accent-emerald-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{m.label}</p>
                      <p className="text-xs text-slate-500">{m.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="mb-3 text-sm font-semibold text-emerald-800">Importación completada</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-700">{result.created}</p>
                <p className="text-xs text-emerald-600">Agregadas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-xs text-blue-600">Actualizadas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700">{result.deleted}</p>
                <p className="text-xs text-red-600">Eliminadas</p>
              </div>
            </div>
            <p className="mt-3 text-center text-sm text-slate-600">Total en cartera: <strong>{result.total}</strong> cuentas</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
