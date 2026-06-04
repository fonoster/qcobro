import { useState, useEffect } from "react";
import { Phone, MessageSquare, Mail, X, Sparkles, Mic, Paperclip, Clock } from "lucide-react";
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
import { TextareaGroup } from "@/components/ui/textarea.js";
import { FilterBar } from "@/components/filter-bar.js";
import { ActivityDetail } from "@/components/activity-detail.js";

const OUTCOME_VARIANTS = {
  CONTACTED: "success",
  NOT_CONTACTED: "secondary",
  PROMISE: "violet",
  REJECTED: "destructive",
  PENDING: "orange"
} as const;

export function Activities() {
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [commsTarget, setCommsTarget] = useState<{ name: string; amount: string; phone: string; email: string; tab: "sms" | "email" | "llamada" } | null>(null);
  const limit = 20;

  const { data, refetch } = trpc.activities.list.useQuery({
    outcome: outcomeFilter as "CONTACTED" | "NOT_CONTACTED" | "PROMISE" | "REJECTED" | "PENDING" | undefined || undefined,
    limit,
    offset: (page - 1) * limit
  });

  const activities = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.activities.title}
        description={t.activities.description}
        action={<Button onClick={() => setShowCreate(true)}>+ {t.activities.newActivity}</Button>}
      />

      <FilterBar
        searchPlaceholder="Buscar por cuenta…"
        filters={[{
          label: "Resultado",
          options: [
            { value: "", label: "Todos los resultados" },
            { value: "CONTACTED", label: t.common.outcome.CONTACTED },
            { value: "NOT_CONTACTED", label: t.common.outcome.NOT_CONTACTED },
            { value: "PROMISE", label: t.common.outcome.PROMISE },
            { value: "REJECTED", label: t.common.outcome.REJECTED },
            { value: "PENDING", label: t.common.outcome.PENDING }
          ],
          onChange: (v) => { setOutcomeFilter(v); setPage(1); }
        }]}
      />

      <DataTable
        data={activities}
        keyField="id"
        searchable={false}
        page={page}
        totalPages={totalPages}
        totalRecords={total}
        onPageChange={setPage}
        onRowClick={(r) => setSelectedId((r as any).id)}
        columns={[
          {
            key: "accountName",
            header: "Deudor",
            render: (r) => (r as any).accountName ?? (r as any).accountId
          },
          {
            key: "campaign",
            header: t.activities.columns.campaign,
            render: (r) => (r as any).campaign?.name ?? "—"
          },
          {
            key: "channel",
            header: t.activities.columns.channel,
            render: (r) => t.common.channel[r.channel as keyof typeof t.common.channel] ?? r.channel
          },
          {
            key: "outcome",
            header: t.activities.columns.outcome,
            render: (r) => (
              <Badge variant={OUTCOME_VARIANTS[r.outcome as keyof typeof OUTCOME_VARIANTS] ?? "secondary"}>
                {t.common.outcome[r.outcome as keyof typeof t.common.outcome] ?? r.outcome}
              </Badge>
            )
          },
          {
            key: "createdAt",
            header: t.activities.columns.date,
            render: (r) => formatDate(r.createdAt)
          },
          {
            key: "actions",
            header: "Acciones",
            align: "center",
            className: "w-[140px]",
            render: (r) => {
              const name = (r as any).accountName ?? (r as any).accountId;
              const amount = (r as any).debtAmount ? `RD$${Number((r as any).debtAmount).toLocaleString()}` : "";
              const phone = (r as any).accountPhone ?? "";
              const email = (r as any).accountEmail ?? "";
              return (
                <span className="inline-flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    title="Llamada"
                    className="text-slate-400 hover:text-slate-700"
                    onClick={() => setCommsTarget({ name, amount, phone, email, tab: "llamada" })}
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                  <button
                    title="SMS"
                    className="text-slate-400 hover:text-slate-700"
                    onClick={() => setCommsTarget({ name, amount, phone, email, tab: "sms" })}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                  <button
                    title="Email"
                    className="text-slate-400 hover:text-slate-700"
                    onClick={() => setCommsTarget({ name, amount, phone, email, tab: "email" })}
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                </span>
              );
            }
          }
        ]}
      />

      {selectedId && (
        <ActivityDetail activityId={selectedId} onClose={() => setSelectedId(null)} />
      )}

      <CreateActivityModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); refetch(); }}
      />

      {commsTarget && (
        <NuevaComunicacion
          name={commsTarget.name}
          amount={commsTarget.amount}
          phone={commsTarget.phone}
          email={commsTarget.email}
          initialTab={commsTarget.tab}
          onClose={() => setCommsTarget(null)}
        />
      )}
    </div>
  );
}

function CreateActivityModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [campaignId, setCampaignId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [channel, setChannel] = useState("CALL");
  const [outcome, setOutcome] = useState("PENDING");
  const [notes, setNotes] = useState("");
  const [agentId, setAgentId] = useState("");

  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const { data: agents } = trpc.agents.list.useQuery();

  const create = trpc.activities.create.useMutation({ onSuccess });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.activities.newActivity}
      description="Registrar una gestión de cobranza"
      confirmLabel={create.isPending ? "Guardando…" : t.common.save}
      onConfirm={() => create.mutate({
        campaignId,
        accountId,
        channel: channel as "CALL" | "SMS" | "WHATSAPP" | "EMAIL",
        outcome: outcome as "CONTACTED" | "NOT_CONTACTED" | "PROMISE" | "REJECTED" | "PENDING",
        agentId: agentId || undefined,
        notes: notes || undefined
      })}
    >
      <div className="mt-4 flex flex-col gap-3">
        <SelectGroup label="Campaña" id="a-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="">Seleccionar campaña…</option>
          {(campaigns ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectGroup>
        <InputGroup label="Cuenta ID" id="a-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="ej. ACC-001" />
        <SelectGroup label="Canal" id="a-channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="CALL">{t.common.channel.CALL}</option>
          <option value="SMS">{t.common.channel.SMS}</option>
          <option value="WHATSAPP">{t.common.channel.WHATSAPP}</option>
          <option value="EMAIL">{t.common.channel.EMAIL}</option>
        </SelectGroup>
        <SelectGroup label="Resultado" id="a-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="PENDING">{t.common.outcome.PENDING}</option>
          <option value="CONTACTED">{t.common.outcome.CONTACTED}</option>
          <option value="NOT_CONTACTED">{t.common.outcome.NOT_CONTACTED}</option>
          <option value="PROMISE">{t.common.outcome.PROMISE}</option>
          <option value="REJECTED">{t.common.outcome.REJECTED}</option>
        </SelectGroup>
        <SelectGroup label="Agente (opcional)" id="a-agent" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">Sin asignar</option>
          {(agents ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </SelectGroup>
        <TextareaGroup label="Notas" id="a-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas opcionales sobre este contacto…" />
      </div>
    </Dialog>
  );
}

const TABS = ["sms", "email", "llamada"] as const;
type Tab = (typeof TABS)[number];

function NuevaComunicacion({ name, amount, phone, email, initialTab, onClose }: { name: string; amount: string; phone: string; email: string; initialTab: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  function handleClose() {
    setOpen(false);
    setTimeout(onClose, 200);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />
      <div
        className={`relative ml-auto flex h-full w-[520px] max-w-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-base font-semibold text-slate-900">Nueva Comunicación</span>
            <span className="text-[13px] text-slate-500">{name} — {amount}</span>
          </div>
          <button onClick={handleClose} className="rounded-md p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 p-6">
            {/* Tab bar */}
            <div>
              <p className="mb-3 text-sm font-medium text-slate-900">Canal de comunicación</p>
              <div className="flex gap-2 rounded-full bg-slate-100 p-1">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      tab === t
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t === "sms" ? "SMS" : t === "email" ? "Email" : "Llamada"}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            {tab === "email" && <EmailForm name={name} amount={amount} email={email} />}
            {tab === "sms" && <SmsForm name={name} amount={amount} phone={phone} />}
            {tab === "llamada" && <LlamadaForm name={name} amount={amount} phone={phone} />}

            {/* AI suggestion */}
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-[13px] font-semibold text-slate-900">Sugerencia IA</span>
              </div>
              <p className="text-[13px] leading-relaxed text-slate-700">
                {tab === "llamada"
                  ? `${name.split(" ")[0]} mostró disposición a negociar en el último SMS. Momento óptimo para llamar: mañana entre 9–11 AM. Se recomienda ofrecer plan de 2 cuotas.`
                  : `Basado en el historial del deudor, se recomienda un tono conciliatorio. Última gestión hace 5 días fue por SMS sin respuesta.`}
              </p>
            </div>

            <div className="h-px bg-slate-200" />

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {tab === "llamada"
                  ? <Mic className="h-[18px] w-[18px] text-slate-400" />
                  : <Paperclip className="h-[18px] w-[18px] text-slate-400" />}
                <Clock className="h-[18px] w-[18px] text-slate-400" />
              </div>
              <Button onClick={() => {
                if (tab === "llamada") {
                  alert("Hello World");
                }
                handleClose();
              }}>
                {tab === "llamada" ? "Iniciar Llamada" : tab === "email" ? "Enviar Email" : "Enviar SMS"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailForm({ name, amount, email }: { name: string; amount: string; email: string }) {
  return (
    <div className="flex flex-col gap-4">
      <InputGroup label="Para" id="nc-to" defaultValue={email} placeholder="correo@ejemplo.com" />
      <InputGroup label="Asunto" id="nc-subject" defaultValue={`Recordatorio de pago — ${amount}`} />
      <TextareaGroup
        label="Mensaje"
        id="nc-body"
        rows={6}
        defaultValue={`Estimado ${name},\n\nLe recordamos que tiene un saldo pendiente de ${amount}.\n\nQuedamos a su disposición.`}
      />
    </div>
  );
}

function SmsForm({ name, amount, phone }: { name: string; amount: string; phone: string }) {
  return (
    <div className="flex flex-col gap-4">
      <InputGroup label="Teléfono" id="nc-phone" defaultValue={phone} placeholder="+1 (809) 555-0000" readOnly />
      <TextareaGroup
        label="Mensaje"
        id="nc-sms-body"
        rows={4}
        defaultValue={`Hola ${name.split(" ")[0]}, le contactamos de Mikro Créditos. Tiene un saldo pendiente de ${amount}. Responda SI para conocer sus opciones.`}
      />
    </div>
  );
}

function LlamadaForm({ phone }: { name: string; amount: string; phone: string }) {
  return (
    <div className="flex flex-col gap-4">
      <InputGroup label="Número de teléfono" id="nc-call-phone" defaultValue={phone} placeholder="+1 (809) 555-0000" readOnly />
      <SelectGroup label="Agente asignado" id="nc-agent">
        <option>Cobros-01 (IA)</option>
        <option>María (IA)</option>
        <option>Juan (IA)</option>
      </SelectGroup>
    </div>
  );
}
