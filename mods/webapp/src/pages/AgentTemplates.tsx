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
  archivedAt: Date | string | null;
  createdAt: Date | string;
};

const TYPE_FILTERS: AgentType[] = ["VOICE_AI", "VOICE_PRERECORDED", "SMS", "EMAIL", "WHATSAPP"];

/** Documentation listing every supported template variable. */
const VARS_DOC_URL = "https://docs.qcobro.com/agentes/variables";
const EXAMPLE_VARS = ["{{firstName}}", "{{principalAmount}}", "{{outstandingBalance}}"];

/** Example template variables + a link to the full reference, under the page header. */
function VariablesHint() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium text-slate-400">{t("agents.vars.label")}</span>
      {EXAMPLE_VARS.map((v) => (
        <code
          key={v}
          className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600"
        >
          {v}
        </code>
      ))}
      <span className="text-slate-300">·</span>
      <a
        href={VARS_DOC_URL}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-emerald-600 underline"
      >
        {t("agents.vars.link")}
      </a>
    </div>
  );
}

export function AgentTemplates() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [typeFilter, setTypeFilter] = useState<"" | AgentType>("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<Template | null>(null);

  const { data } = trpc.agentTemplates.list.useQuery({
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(includeArchived ? { includeArchived: true } : {})
  });
  const templates: Template[] = (data ?? []) as Template[];

  function invalidate() {
    utils.agentTemplates.list.invalidate();
  }

  const del = trpc.agentTemplates.delete.useMutation({
    onSuccess: () => {
      setDeleting(null);
      invalidate();
    }
  });

  const setArchived = trpc.agentTemplates.update.useMutation({ onSuccess: invalidate });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <PageHeader title={t("agents.title")} description={t("agents.description")} />
        <VariablesHint />
      </div>

      <DataTable
        data={templates}
        keyField="id"
        searchable={false}
        filterElement={
          <div className="flex items-center gap-4">
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
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              {t("agents.filter.showArchived")}
            </label>
          </div>
        }
        actionLabel={t("agents.new")}
        onAction={() => setShowCreate(true)}
        onRowClick={(row) => navigate(`/agent-templates/${row.id}`)}
        columns={[
          {
            key: "name",
            header: t("agents.col.name"),
            render: (r) =>
              r.archivedAt ? (
                <span className="inline-flex items-center gap-2">
                  {r.name}
                  <Badge variant="secondary">{t("agents.archivedBadge")}</Badge>
                </span>
              ) : (
                r.name
              )
          },
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
                  r.archivedAt
                    ? {
                        label: t("agents.actions.restore"),
                        onClick: () => setArchived.mutate({ id: r.id, archived: false })
                      }
                    : {
                        label: t("agents.actions.archive"),
                        onClick: () => setArchived.mutate({ id: r.id, archived: true })
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
const LANGUAGES = ["es", "en"] as const;

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
  const [fields, setFields] = useState<Record<string, string>>({ language: "es" });
  const [error, setError] = useState<string | null>(null);

  const { data: voices } = trpc.config.voices.useQuery();

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
    const base = { name: name.trim() };
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
          language: fields.language ?? "es"
        };
        break;
      case "SMS":
        payload = {
          ...base,
          type,
          messageBody: fields.messageBody ?? "",
          ...(fields.senderId ? { senderId: fields.senderId } : {})
        };
        break;
      case "EMAIL":
        payload = {
          ...base,
          type,
          fromName: fields.fromName ?? "",
          fromEmail: fields.fromEmail ?? "",
          subject: fields.subject ?? "",
          messageBody: fields.messageBody ?? "",
          systemPrompt: fields.systemPrompt ?? "",
          ...(fields.maxReplies ? { maxReplies: Number(fields.maxReplies) } : {})
        };
        break;
      case "WHATSAPP":
        payload = {
          ...base,
          type,
          templateName: fields.templateName ?? "",
          messageBody: fields.messageBody ?? ""
        };
        break;
    }
    create.mutate(payload as never);
  }

  const isVoice = type === "VOICE_AI" || type === "VOICE_PRERECORDED";

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
            <option key={tp} value={tp}>
              {t(`agents.type.${tp}` as Parameters<typeof t>[0])}
            </option>
          ))}
        </SelectGroup>

        {isVoice && (
          <>
            <SelectGroup
              label={t("agents.form.language")}
              id="a-lang"
              value={fields.language ?? "es"}
              onChange={(e) => set("language", e.target.value)}
            >
              {LANGUAGES.map((lng) => (
                <option key={lng} value={lng}>
                  {t(`agents.lang.${lng}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </SelectGroup>
            <SelectGroup
              label={t("agents.form.voice")}
              id="a-voice"
              value={fields.voice ?? ""}
              onChange={(e) => set("voice", e.target.value)}
            >
              <option value="" disabled>
                {t("agents.form.voicePlaceholder")}
              </option>
              {(voices ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {`${v.name} (${v.language}, ${t(`agents.gender.${v.gender}` as Parameters<typeof t>[0])})`}
                </option>
              ))}
            </SelectGroup>
          </>
        )}

        {type === "VOICE_AI" && (
          <>
            <InputGroup
              label={t("agents.form.firstMessage")}
              id="a-first"
              value={fields.firstMessage ?? ""}
              onChange={(e) => set("firstMessage", e.target.value)}
            />
            <TextareaGroup
              label={t("agents.form.systemPrompt")}
              id="a-prompt"
              value={fields.systemPrompt ?? ""}
              onChange={(e) => set("systemPrompt", e.target.value)}
            />
          </>
        )}

        {type === "VOICE_PRERECORDED" && (
          <TextareaGroup
            label={t("agents.form.script")}
            id="a-script"
            value={fields.script ?? ""}
            onChange={(e) => set("script", e.target.value)}
          />
        )}

        {type === "SMS" && (
          <>
            <TextareaGroup
              label={t("agents.form.messageBody")}
              id="a-sms"
              value={fields.messageBody ?? ""}
              onChange={(e) => set("messageBody", e.target.value)}
            />
            <InputGroup
              label={t("agents.form.senderId")}
              id="a-sender"
              value={fields.senderId ?? ""}
              onChange={(e) => set("senderId", e.target.value)}
            />
          </>
        )}

        {type === "EMAIL" && (
          <>
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
            <TextareaGroup
              label={t("agents.form.systemPrompt")}
              id="a-email-prompt"
              value={fields.systemPrompt ?? ""}
              onChange={(e) => set("systemPrompt", e.target.value)}
            />
            <InputGroup
              label={t("agents.form.maxReplies")}
              id="a-email-maxreplies"
              type="number"
              value={fields.maxReplies ?? ""}
              onChange={(e) => set("maxReplies", e.target.value)}
            />
          </>
        )}

        {type === "WHATSAPP" && (
          <>
            <InputGroup
              label={t("agents.form.templateName")}
              id="a-template"
              value={fields.templateName ?? ""}
              onChange={(e) => set("templateName", e.target.value)}
            />
            <TextareaGroup
              label={t("agents.form.messageBody")}
              id="a-wa-body"
              value={fields.messageBody ?? ""}
              onChange={(e) => set("messageBody", e.target.value)}
            />
          </>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
