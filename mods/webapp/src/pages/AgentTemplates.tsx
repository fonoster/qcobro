import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable } from "../components/ui/data-table.js";
import { Dialog } from "../components/ui/dialog.js";
import { ConfirmDeleteDialog } from "../components/ui/confirm-delete-dialog.js";
import { InputGroup } from "../components/ui/input.js";
import { TextareaGroup } from "../components/ui/textarea.js";
import { SelectGroup, FilterSelect } from "../components/ui/select.js";
import { Badge } from "../components/ui/badge.js";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";

type AgentType = "VOICE_AI" | "VOICE_PRERECORDED" | "SMS" | "EMAIL" | "WHATSAPP";

type Template = {
  id: string;
  name: string;
  type: AgentType;
  collectionStrategy: string;
  totalCalls: number;
  createdAt: Date | string;
};

const TYPE_FILTERS: AgentType[] = ["VOICE_AI", "VOICE_PRERECORDED", "SMS", "EMAIL", "WHATSAPP"];

export function AgentTemplates() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [typeFilter, setTypeFilter] = useState<"" | AgentType>("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<Template | null>(null);

  const { data } = trpc.agentTemplates.list.useQuery(typeFilter ? { type: typeFilter } : undefined);
  const templates: Template[] = (data ?? []) as Template[];

  const del = trpc.agentTemplates.delete.useMutation({
    onSuccess: () => {
      setDeleting(null);
      utils.agentTemplates.list.invalidate();
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("agents.title")} description={t("agents.description")} />

      <DataTable
        data={templates}
        keyField="id"
        searchable={false}
        filterElement={
          <FilterSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | AgentType)}
          >
            <option value="">{t("agents.filter.allTypes")}</option>
            {TYPE_FILTERS.map((tp) => (
              <option key={tp} value={tp}>
                {t(`agents.type.${tp}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </FilterSelect>
        }
        actionLabel={t("agents.new")}
        onAction={() => setShowCreate(true)}
        onRowClick={(row) => navigate(`/agent-templates/${row.id}`)}
        columns={[
          { key: "name", header: t("agents.col.name") },
          {
            key: "type",
            header: t("agents.col.type"),
            render: (r) => (
              <Badge variant="secondary">
                {t(`agents.type.${r.type}` as Parameters<typeof t>[0])}
              </Badge>
            )
          },
          {
            key: "collectionStrategy",
            header: t("agents.col.strategy"),
            render: (r) => t(`agents.strategy.${r.collectionStrategy}` as Parameters<typeof t>[0])
          },
          {
            key: "totalCalls",
            header: t("agents.col.calls"),
            render: (r) => r.totalCalls.toLocaleString()
          },
          {
            key: "createdAt",
            header: t("agents.col.created"),
            render: (r) => new Date(r.createdAt).toLocaleDateString()
          },
          {
            key: "id",
            header: "",
            align: "center",
            render: (r) => (
              <RowActionsMenu
                items={[
                  {
                    label: t("agents.actions.view"),
                    onClick: () => navigate(`/agent-templates/${r.id}`)
                  },
                  {
                    label: t("agents.actions.delete"),
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
        <CreateAgentTemplateModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            utils.agentTemplates.list.invalidate();
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && del.mutate({ id: deleting.id })}
        isPending={del.isPending}
        title={`${t("agents.delete.title")} "${deleting?.name ?? ""}"`}
        description={t("agents.delete.description")}
      />
    </div>
  );
}

const CREATABLE_TYPES: AgentType[] = ["VOICE_AI", "VOICE_PRERECORDED", "SMS", "EMAIL", "WHATSAPP"];

function CreateAgentTemplateModal({
  onClose,
  onSuccess
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [type, setType] = useState<AgentType>("VOICE_AI");
  const [strategy, setStrategy] = useState("MODERATE");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const create = trpc.agentTemplates.create.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function set(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function handleCreate() {
    if (!name.trim()) {
      setError(t("agents.form.name"));
      return;
    }
    setError(null);
    const base = {
      name: name.trim(),
      collectionStrategy: strategy as "SOFT" | "MODERATE" | "FIRM"
    };
    let payload: Record<string, unknown>;
    switch (type) {
      case "VOICE_AI":
        payload = {
          ...base,
          type,
          voice: fields.voice ?? "",
          systemPrompt: fields.systemPrompt ?? "",
          firstMessage: fields.firstMessage ?? "",
          language: fields.language ?? "es"
        };
        break;
      case "VOICE_PRERECORDED":
        payload = {
          ...base,
          type,
          voice: fields.voice ?? "",
          script: fields.script ?? "",
          firstMessage: fields.firstMessage ?? "",
          language: fields.language ?? "es"
        };
        break;
      case "SMS":
        payload = { ...base, type, messageBody: fields.messageBody ?? "" };
        break;
      case "EMAIL":
        payload = {
          ...base,
          type,
          subject: fields.subject ?? "",
          messageBody: fields.messageBody ?? "",
          fromName: fields.fromName ?? "",
          fromEmail: fields.fromEmail ?? ""
        };
        break;
      default:
        return; // WHATSAPP disabled
    }
    create.mutate(payload as never);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("agents.new")}
      confirmLabel={create.isPending ? "…" : t("agents.form.create")}
      onConfirm={handleCreate}
    >
      <div className="mt-4 flex flex-col gap-3">
        <InputGroup
          label={t("agents.form.name")}
          id="a-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <SelectGroup
          label={t("agents.form.type")}
          id="a-type"
          value={type}
          onChange={(e) => setType(e.target.value as AgentType)}
        >
          {CREATABLE_TYPES.map((tp) => (
            <option key={tp} value={tp} disabled={tp === "WHATSAPP"}>
              {t(`agents.type.${tp}` as Parameters<typeof t>[0])}
              {tp === "WHATSAPP" ? ` — ${t("agents.whatsapp.soon")}` : ""}
            </option>
          ))}
        </SelectGroup>
        <SelectGroup
          label={t("agents.form.strategy")}
          id="a-strategy"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
        >
          <option value="SOFT">{t("agents.strategy.SOFT")}</option>
          <option value="MODERATE">{t("agents.strategy.MODERATE")}</option>
          <option value="FIRM">{t("agents.strategy.FIRM")}</option>
        </SelectGroup>

        {(type === "VOICE_AI" || type === "VOICE_PRERECORDED") && (
          <>
            <InputGroup
              label={t("agents.form.voice")}
              id="a-voice"
              value={fields.voice ?? ""}
              onChange={(e) => set("voice", e.target.value)}
            />
            {type === "VOICE_AI" ? (
              <TextareaGroup
                label={t("agents.form.systemPrompt")}
                id="a-prompt"
                value={fields.systemPrompt ?? ""}
                onChange={(e) => set("systemPrompt", e.target.value)}
              />
            ) : (
              <TextareaGroup
                label={t("agents.form.script")}
                id="a-script"
                value={fields.script ?? ""}
                onChange={(e) => set("script", e.target.value)}
              />
            )}
            <InputGroup
              label={t("agents.form.firstMessage")}
              id="a-first"
              value={fields.firstMessage ?? ""}
              onChange={(e) => set("firstMessage", e.target.value)}
            />
            <InputGroup
              label={t("agents.form.language")}
              id="a-lang"
              value={fields.language ?? ""}
              onChange={(e) => set("language", e.target.value)}
              placeholder="es"
            />
          </>
        )}

        {type === "SMS" && (
          <TextareaGroup
            label={t("agents.form.messageBody")}
            id="a-sms"
            value={fields.messageBody ?? ""}
            onChange={(e) => set("messageBody", e.target.value)}
          />
        )}

        {type === "EMAIL" && (
          <>
            <InputGroup
              label={t("agents.form.subject")}
              id="a-subject"
              value={fields.subject ?? ""}
              onChange={(e) => set("subject", e.target.value)}
            />
            <TextareaGroup
              label={t("agents.form.messageBody")}
              id="a-email-body"
              value={fields.messageBody ?? ""}
              onChange={(e) => set("messageBody", e.target.value)}
            />
            <InputGroup
              label={t("agents.form.fromName")}
              id="a-fromname"
              value={fields.fromName ?? ""}
              onChange={(e) => set("fromName", e.target.value)}
            />
            <InputGroup
              label={t("agents.form.fromEmail")}
              id="a-fromemail"
              value={fields.fromEmail ?? ""}
              onChange={(e) => set("fromEmail", e.target.value)}
            />
          </>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
