import { useState } from "react";
import { trpc } from "@/lib/trpc.js";
import { t } from "@/lib/i18n.js";
import { formatDate } from "@qcobro/common";
import { PageHeader } from "@/components/page-header.js";
import { DataTable } from "@/components/ui/data-table.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Dialog } from "@/components/ui/dialog.js";
import { InputGroup } from "@/components/ui/input.js";
import { SelectGroup } from "@/components/ui/select.js";
import { FilterBar } from "@/components/filter-bar.js";

type Channel = "VOICE" | "VOICE_AI" | "WHATSAPP" | "SMS" | "EMAIL";

function DayProgress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min((done / total) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-500 whitespace-nowrap">
        {done}/{total}
      </span>
    </div>
  );
}

const STATUS_VARIANTS = {
  SCHEDULED: "secondary",
  IN_PROGRESS: "success",
  COMPLETED: "violet",
  CANCELLED: "destructive"
} as const;

export function Campaigns() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const { data, refetch } = trpc.campaigns.list.useQuery(
    statusFilter ? { status: statusFilter as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" } : undefined
  );
  const campaigns = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.campaigns.title}
        description={t.campaigns.description}
        action={<Button onClick={() => setShowCreate(true)}>+ {t.campaigns.newCampaign}</Button>}
      />

      <FilterBar
        searchPlaceholder="Buscar campañas…"
        filters={[{
          label: "Estado",
          options: [
            { value: "", label: "Todos los estados" },
            { value: "SCHEDULED", label: t.common.status.SCHEDULED },
            { value: "IN_PROGRESS", label: t.common.status.IN_PROGRESS },
            { value: "COMPLETED", label: t.common.status.COMPLETED },
            { value: "CANCELLED", label: t.common.status.CANCELLED }
          ],
          onChange: setStatusFilter
        }]}
      />

      <DataTable
        data={campaigns}
        keyField="id"
        searchable={false}
        columns={[
          { key: "name", header: t.campaigns.columns.name },
          {
            key: "portfolio",
            header: t.campaigns.columns.portfolio,
            render: (r) => (r as any).portfolio?.name ?? "—"
          },
          {
            key: "agent",
            header: t.campaigns.columns.agent,
            render: (r) => (r as any).agent?.name ?? "—"
          },
          {
            key: "channel",
            header: t.campaigns.columns.channel,
            render: (r) => t.common.channel[r.channel as keyof typeof t.common.channel] ?? r.channel
          },
          {
            key: "accounts",
            header: t.campaigns.columns.accounts,
            render: (r) => r.accounts.toLocaleString()
          },
          {
            key: "status",
            header: t.campaigns.columns.status,
            render: (r) => (
              <Badge variant={STATUS_VARIANTS[r.status as keyof typeof STATUS_VARIANTS] ?? "secondary"}>
                {t.common.status[r.status as keyof typeof t.common.status] ?? r.status}
              </Badge>
            )
          },
          {
            key: "todayActivities",
            header: "Progreso hoy",
            render: (r) => (
              <DayProgress
                done={(r as any).todayActivities ?? 0}
                total={r.accounts as number}
              />
            )
          },
          {
            key: "startDate",
            header: t.campaigns.columns.startDate,
            render: (r) => r.startDate ? formatDate(r.startDate) : "—"
          },
          {
            key: "endDate",
            header: t.campaigns.columns.endDate,
            render: (r) => r.endDate ? formatDate(r.endDate) : "—"
          },
          {
            key: "id",
            header: "",
            render: (r) => (
              <Button size="sm" variant="ghost" onClick={() => setEditing(r.id)}>{t.common.edit}</Button>
            )
          }
        ]}
      />

      <CreateCampaignModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); refetch(); }}
      />
      {editing && (
        <EditCampaignModal
          id={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); refetch(); }}
        />
      )}
    </div>
  );
}

function CreateCampaignModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [portfolioId, setPortfolioId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [channel, setChannel] = useState<Channel>("VOICE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: portfolios } = trpc.portfolios.list.useQuery();
  const { data: agents } = trpc.agents.list.useQuery();
  const create = trpc.campaigns.create.useMutation({ onSuccess });

  const selectedPortfolio = (portfolios ?? []).find((p) => p.id === portfolioId);
  const accountCount = selectedPortfolio?.accounts ?? 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.campaigns.newCampaign}
      confirmLabel={create.isPending ? "Creando…" : t.common.create}
      onConfirm={() => create.mutate({
        name,
        portfolioId,
        agentId: agentId || undefined,
        channel,
        accounts: accountCount,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined
      })}
    >
      <div className="mt-4 flex flex-col gap-3">
        <InputGroup label="Nombre" id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. Preventiva Q3" />
        <SelectGroup label="Cartera" id="c-portfolio" value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
          <option value="">Seleccionar cartera…</option>
          {(portfolios ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.accounts} cuentas)</option>)}
        </SelectGroup>
        <SelectGroup label="Agente IA" id="c-agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">Sin agente</option>
          {(agents ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({t.common.channel[a.channel as keyof typeof t.common.channel] ?? a.channel})</option>
          ))}
        </SelectGroup>
        <SelectGroup label="Canal" id="c-channel" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
          <option value="VOICE">{t.common.channel.VOICE}</option>
          <option value="VOICE_AI">{t.common.channel.VOICE_AI}</option>
          <option value="WHATSAPP">{t.common.channel.WHATSAPP}</option>
          <option value="SMS">{t.common.channel.SMS}</option>
          <option value="EMAIL">{t.common.channel.EMAIL}</option>
        </SelectGroup>
        <InputGroup label="Cuentas" id="c-accounts" type="number" value={String(accountCount)} readOnly disabled placeholder="Seleccione una cartera" />
        <InputGroup label="Fecha de inicio" id="c-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <InputGroup label="Fecha de fin" id="c-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
    </Dialog>
  );
}

function EditCampaignModal({ id, onClose, onSuccess }: { id: string; onClose: () => void; onSuccess: () => void }) {
  const { data } = trpc.campaigns.get.useQuery({ id });
  const { data: agents } = trpc.agents.list.useQuery();
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState<string | null | undefined>(undefined);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");

  const update = trpc.campaigns.update.useMutation({ onSuccess });
  const del = trpc.campaigns.delete.useMutation({ onSuccess });

  if (!data) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t.campaigns.editCampaign}
      confirmLabel={update.isPending ? "Guardando…" : t.common.save}
      onConfirm={() => update.mutate({
        id,
        name: name || data.name,
        agentId: agentId !== undefined ? agentId : data.agentId,
        channel: (channel || data.channel) as Channel,
        status: (status || data.status) as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
      })}
    >
      <div className="mt-4 flex flex-col gap-3">
        <InputGroup label="Nombre" id="ec-name" defaultValue={data.name} onChange={(e) => setName(e.target.value)} />
        <SelectGroup label="Agente IA" id="ec-agent" defaultValue={data.agentId ?? ""} onChange={(e) => setAgentId(e.target.value || null)}>
          <option value="">Sin agente</option>
          {(agents ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({t.common.channel[a.channel as keyof typeof t.common.channel] ?? a.channel})</option>
          ))}
        </SelectGroup>
        <SelectGroup label="Canal" id="ec-channel" defaultValue={data.channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="VOICE">{t.common.channel.VOICE}</option>
          <option value="VOICE_AI">{t.common.channel.VOICE_AI}</option>
          <option value="WHATSAPP">{t.common.channel.WHATSAPP}</option>
          <option value="SMS">{t.common.channel.SMS}</option>
          <option value="EMAIL">{t.common.channel.EMAIL}</option>
        </SelectGroup>
        <SelectGroup label="Estado" id="ec-status" defaultValue={data.status} onChange={(e) => setStatus(e.target.value)}>
          <option value="SCHEDULED">{t.common.status.SCHEDULED}</option>
          <option value="IN_PROGRESS">{t.common.status.IN_PROGRESS}</option>
          <option value="COMPLETED">{t.common.status.COMPLETED}</option>
          <option value="CANCELLED">{t.common.status.CANCELLED}</option>
        </SelectGroup>
        <Button variant="destructive" size="sm" onClick={() => del.mutate({ id })} disabled={del.isPending}>
          {del.isPending ? "Eliminando…" : "Eliminar campaña"}
        </Button>
      </div>
    </Dialog>
  );
}
