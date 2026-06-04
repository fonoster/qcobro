import { useState } from "react";
import { trpc } from "@/lib/trpc.js";
import { t } from "@/lib/i18n.js";
import { formatMoney, formatPercent } from "@qcobro/common";
import { PageHeader } from "@/components/page-header.js";
import { DataTable } from "@/components/ui/data-table.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Dialog } from "@/components/ui/dialog.js";
import { InputGroup } from "@/components/ui/input.js";
import { SelectGroup } from "@/components/ui/select.js";
import { FilterBar } from "@/components/filter-bar.js";

type Channel = "VOICE" | "VOICE_AI" | "WHATSAPP" | "SMS" | "EMAIL";
type Strategy = "AGGRESSIVE" | "MODERATE" | "GENTLE";

export function Agents() {
  const [statusFilter, setStatusFilter] = useState("");
  const [strategyFilter, setStrategyFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const { data, refetch } = trpc.agents.list.useQuery({
    status: statusFilter as "ACTIVE" | "PAUSED" | undefined || undefined,
    strategy: strategyFilter as Strategy | undefined || undefined,
    channel: channelFilter as Channel | undefined || undefined
  });
  const agents = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.agents.title}
        description={t.agents.description}
        action={<Button onClick={() => setShowCreate(true)}>+ {t.agents.newAgent}</Button>}
      />

      <FilterBar
        searchPlaceholder="Buscar agentes…"
        filters={[
          {
            label: "Estado",
            options: [
              { value: "", label: "Todos los estados" },
              { value: "ACTIVE", label: t.common.status.ACTIVE },
              { value: "PAUSED", label: t.common.status.PAUSED }
            ],
            onChange: setStatusFilter
          },
          {
            label: "Canal",
            options: [
              { value: "", label: "Todos los canales" },
              { value: "VOICE", label: t.common.channel.VOICE },
              { value: "VOICE_AI", label: t.common.channel.VOICE_AI },
              { value: "WHATSAPP", label: t.common.channel.WHATSAPP },
              { value: "SMS", label: t.common.channel.SMS },
              { value: "EMAIL", label: t.common.channel.EMAIL }
            ],
            onChange: setChannelFilter
          },
          {
            label: "Estrategia",
            options: [
              { value: "", label: "Todas las estrategias" },
              { value: "AGGRESSIVE", label: t.common.strategy.AGGRESSIVE },
              { value: "MODERATE", label: t.common.strategy.MODERATE },
              { value: "GENTLE", label: t.common.strategy.GENTLE }
            ],
            onChange: setStrategyFilter
          }
        ]}
      />

      <DataTable
        data={agents}
        keyField="id"
        searchable={false}
        columns={[
          { key: "name", header: t.agents.columns.name },
          { key: "email", header: t.agents.columns.email },
          {
            key: "channel",
            header: t.agents.columns.channel,
            render: (r) => t.common.channel[r.channel as keyof typeof t.common.channel] ?? r.channel
          },
          {
            key: "strategy",
            header: t.agents.columns.strategy,
            render: (r) => t.common.strategy[r.strategy as keyof typeof t.common.strategy] ?? r.strategy
          },
          {
            key: "status",
            header: t.agents.columns.status,
            render: (r) => (
              <Badge variant={r.status === "ACTIVE" ? "success" : "secondary"}>
                {r.status === "ACTIVE" ? t.common.status.ACTIVE : t.common.status.PAUSED}
              </Badge>
            )
          },
          {
            key: "calls",
            header: t.agents.columns.calls,
            render: (r) => r.calls.toLocaleString()
          },
          {
            key: "successRate",
            header: t.agents.columns.successRate,
            render: (r) => formatPercent(r.successRate)
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

      <CreateAgentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); refetch(); }}
      />
      {editing && (
        <EditAgentModal
          id={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); refetch(); }}
        />
      )}
    </div>
  );
}

function CreateAgentModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState<Channel>("VOICE");
  const [strategy, setStrategy] = useState<Strategy>("MODERATE");

  const create = trpc.agents.create.useMutation({ onSuccess });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.agents.newAgent}
      confirmLabel={create.isPending ? "Creando…" : t.common.create}
      onConfirm={() => create.mutate({ name, email, channel, strategy })}
    >
      <div className="mt-4 flex flex-col gap-3">
        <InputGroup label="Nombre" id="ag-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del agente" />
        <InputGroup label="Correo" id="ag-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agente@empresa.com" />
        <SelectGroup label="Canal" id="ag-channel" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
          <option value="VOICE">{t.common.channel.VOICE}</option>
          <option value="VOICE_AI">{t.common.channel.VOICE_AI}</option>
          <option value="WHATSAPP">{t.common.channel.WHATSAPP}</option>
          <option value="SMS">{t.common.channel.SMS}</option>
          <option value="EMAIL">{t.common.channel.EMAIL}</option>
        </SelectGroup>
        <SelectGroup label="Estrategia" id="ag-strategy" value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)}>
          <option value="AGGRESSIVE">{t.common.strategy.AGGRESSIVE}</option>
          <option value="MODERATE">{t.common.strategy.MODERATE}</option>
          <option value="GENTLE">{t.common.strategy.GENTLE}</option>
        </SelectGroup>
      </div>
    </Dialog>
  );
}

function EditAgentModal({ id, onClose, onSuccess }: { id: string; onClose: () => void; onSuccess: () => void }) {
  const { data } = trpc.agents.get.useQuery({ id });
  const [channel, setChannel] = useState("");
  const [strategy, setStrategy] = useState("");
  const [status, setStatus] = useState("");

  const update = trpc.agents.update.useMutation({ onSuccess });
  const del = trpc.agents.delete.useMutation({ onSuccess });

  if (!data) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t.agents.editAgent}: ${data.name}`}
      confirmLabel={update.isPending ? "Guardando…" : t.common.save}
      onConfirm={() => update.mutate({
        id,
        channel: (channel || data.channel) as Channel,
        strategy: (strategy || data.strategy) as Strategy,
        status: (status || data.status) as "ACTIVE" | "PAUSED"
      })}
    >
      <div className="mt-4 flex flex-col gap-3">
        <SelectGroup label="Canal" id="ea-channel" defaultValue={data.channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="VOICE">{t.common.channel.VOICE}</option>
          <option value="VOICE_AI">{t.common.channel.VOICE_AI}</option>
          <option value="WHATSAPP">{t.common.channel.WHATSAPP}</option>
          <option value="SMS">{t.common.channel.SMS}</option>
          <option value="EMAIL">{t.common.channel.EMAIL}</option>
        </SelectGroup>
        <SelectGroup label="Estrategia" id="ea-strategy" defaultValue={data.strategy} onChange={(e) => setStrategy(e.target.value)}>
          <option value="AGGRESSIVE">{t.common.strategy.AGGRESSIVE}</option>
          <option value="MODERATE">{t.common.strategy.MODERATE}</option>
          <option value="GENTLE">{t.common.strategy.GENTLE}</option>
        </SelectGroup>
        <SelectGroup label="Estado" id="ea-status" defaultValue={data.status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ACTIVE">{t.common.status.ACTIVE}</option>
          <option value="PAUSED">{t.common.status.PAUSED}</option>
        </SelectGroup>
        <Button variant="destructive" size="sm" onClick={() => del.mutate({ id })} disabled={del.isPending}>
          {del.isPending ? "Eliminando…" : "Eliminar agente"}
        </Button>
      </div>
    </Dialog>
  );
}
