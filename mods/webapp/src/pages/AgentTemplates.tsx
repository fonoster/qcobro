import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable } from "../components/ui/data-table.js";
import { Dialog } from "../components/ui/dialog.js";
import { ConfirmDeleteDialog } from "../components/ui/confirm-delete-dialog.js";
import { Button } from "../components/ui/button.js";
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

/** Mirrors the deployment default (`resend`/`whatsapp` config's `maxRepliesDefault`). */
const DEFAULT_MAX_REPLIES = 3;

/** Documentation listing every supported template variable. */
const VARS_DOC_URL = "https://docs.qcobro.com/guides/agent-templates#variables-disponibles";
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
  const [editing, setEditing] = useState<Template | null>(null);
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
            align: "right",
            className: "w-px whitespace-nowrap",
            render: (r) => (
              <RowActionsMenu
                items={[
                  {
                    label: t("agents.actions.edit"),
                    onClick: () => setEditing(r)
                  },
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

      {editing && (
        <EditAgentTemplateModal
          template={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
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
  const templateNameDebounced = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedTemplateName, setDebouncedTemplateName] = useState("");

  const { data: voices } = trpc.config.voices.useQuery();
  const integration = trpc.whatsAppIntegration.get.useQuery(undefined, {
    enabled: type === "WHATSAPP"
  });
  const preview = trpc.whatsAppIntegration.previewTemplate.useQuery(
    { templateName: debouncedTemplateName },
    { enabled: type === "WHATSAPP" && debouncedTemplateName.length > 0 }
  );

  // Clear the stale body immediately when the target name changes, so a lingering success
  // from the previous name is never mistaken for the new one's — before this, changing the
  // template name after a successful lookup silently kept showing (and would have saved) the
  // old template's body until/unless the new lookup also succeeded. Guarded on non-empty so
  // it doesn't fire on mount and mask the "enter a name" empty-state hint below.
  useEffect(() => {
    if (!debouncedTemplateName) return;
    setFields((f) => ({ ...f, messageBody: "" }));
  }, [debouncedTemplateName]);

  useEffect(() => {
    if (preview.data) {
      setFields((f) => ({ ...f, messageBody: preview.data?.body ?? "" }));
    }
  }, [preview.data]);

  const create = trpc.agentTemplates.create.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function set(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    if (key === "templateName") {
      if (templateNameDebounced.current) clearTimeout(templateNameDebounced.current);
      templateNameDebounced.current = setTimeout(() => setDebouncedTemplateName(value.trim()), 600);
    }
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
          messageBody: fields.messageBody ?? "",
          systemPrompt: fields.systemPrompt ?? "",
          ...(fields.maxReplies ? { maxReplies: Number(fields.maxReplies) } : {})
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
              placeholder={String(DEFAULT_MAX_REPLIES)}
              value={fields.maxReplies ?? ""}
              onChange={(e) => set("maxReplies", e.target.value)}
            />
          </>
        )}

        {type === "WHATSAPP" && (
          <>
            {!integration.data?.connected && !integration.isLoading && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {t("agents.form.noIntegrationWarning")}
              </p>
            )}
            <InputGroup
              label={t("agents.form.templateName")}
              id="a-wa-tname"
              value={fields.templateName ?? ""}
              onChange={(e) => set("templateName", e.target.value)}
            />
            <TextareaGroup
              label={t("agents.form.templatePreview")}
              id="a-wa-body"
              readOnly
              value={
                preview.isFetching
                  ? t("agents.form.templatePreviewLoading")
                  : (fields.messageBody ??
                    (debouncedTemplateName ? "" : t("agents.form.templatePreviewEmpty")))
              }
              onChange={() => undefined}
              className="text-slate-500"
            />
            {preview.isError && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-red-600">{t("agents.form.templatePreviewError")}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => preview.refetch()}
                >
                  {t("common.retry")}
                </Button>
              </div>
            )}
            {!preview.isFetching &&
              !preview.isError &&
              preview.isFetched &&
              preview.data === null &&
              integration.data?.connected && (
                <p className="text-xs text-amber-700">{t("agents.form.templateNotFound")}</p>
              )}
            <TextareaGroup
              label={t("agents.form.systemPrompt")}
              id="a-wa-prompt"
              value={fields.systemPrompt ?? ""}
              onChange={(e) => set("systemPrompt", e.target.value)}
            />
            <InputGroup
              label={t("agents.form.maxReplies")}
              id="a-wa-maxreplies"
              type="number"
              placeholder={String(DEFAULT_MAX_REPLIES)}
              value={fields.maxReplies ?? ""}
              onChange={(e) => set("maxReplies", e.target.value)}
            />
          </>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}

type FullTemplate = {
  id: string;
  name: string;
  type: AgentType;
  voiceAiConfig: Record<string, unknown> | null;
  voicePrerecordedConfig: Record<string, unknown> | null;
  smsConfig: Record<string, unknown> | null;
  emailConfig: Record<string, unknown> | null;
  whatsAppConfig: Record<string, unknown> | null;
};

function EditAgentTemplateModal({
  template,
  onClose,
  onSuccess
}: {
  template: Template;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const query = trpc.agentTemplates.get.useQuery({ id: template.id });
  const full = query.data as FullTemplate | undefined;

  const { data: voices } = trpc.config.voices.useQuery();
  const [name, setName] = useState(template.name);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const templateNameDebounced = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedTemplateName, setDebouncedTemplateName] = useState("");

  const integration = trpc.whatsAppIntegration.get.useQuery(undefined, {
    enabled: template.type === "WHATSAPP"
  });
  const preview = trpc.whatsAppIntegration.previewTemplate.useQuery(
    { templateName: debouncedTemplateName },
    { enabled: template.type === "WHATSAPP" && debouncedTemplateName.length > 0 }
  );

  // Clear the stale body immediately when the target name changes — see the matching
  // comment in CreateAgentTemplateModal for why this can't just wait on preview.data.
  useEffect(() => {
    if (!debouncedTemplateName) return;
    setFields((f) => ({ ...f, messageBody: "" }));
  }, [debouncedTemplateName]);

  useEffect(() => {
    if (preview.data) {
      setFields((f) => ({ ...f, messageBody: preview.data?.body ?? "" }));
    }
  }, [preview.data]);

  useEffect(() => {
    if (!full || seeded) return;
    const cfg =
      full.voiceAiConfig ??
      full.voicePrerecordedConfig ??
      full.smsConfig ??
      full.emailConfig ??
      full.whatsAppConfig ??
      {};
    const f: Record<string, string> = {};
    for (const [k, v] of Object.entries(cfg)) {
      // fonosterAppRef is an internal ref the operator never edits; templateId is the
      // Prisma FK to the parent AgentTemplate row, not an editable field.
      if (v != null && k !== "fonosterAppRef" && k !== "templateId") f[k] = String(v);
    }
    setFields(f);
    setSeeded(true);
  }, [full, seeded]);

  const update = trpc.agentTemplates.update.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function set(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    if (key === "templateName") {
      if (templateNameDebounced.current) clearTimeout(templateNameDebounced.current);
      templateNameDebounced.current = setTimeout(() => setDebouncedTemplateName(value.trim()), 600);
    }
  }

  function handleSave() {
    if (!name.trim()) {
      setError(t("agents.form.name"));
      return;
    }
    setError(null);
    let config: Record<string, unknown> = {};
    switch (template.type) {
      case "VOICE_AI":
        config = {
          voice: fields.voice,
          systemPrompt: fields.systemPrompt,
          firstMessage: fields.firstMessage,
          language: fields.language
        };
        break;
      case "VOICE_PRERECORDED":
        config = { voice: fields.voice, script: fields.script, language: fields.language };
        break;
      case "SMS":
        config = {
          messageBody: fields.messageBody,
          ...(fields.senderId ? { senderId: fields.senderId } : {})
        };
        break;
      case "EMAIL":
        config = {
          subject: fields.subject,
          messageBody: fields.messageBody,
          systemPrompt: fields.systemPrompt,
          maxReplies: fields.maxReplies ? Number(fields.maxReplies) : null
        };
        break;
      case "WHATSAPP":
        config = {
          templateName: fields.templateName,
          messageBody: fields.messageBody,
          systemPrompt: fields.systemPrompt,
          maxReplies: fields.maxReplies ? Number(fields.maxReplies) : null
        };
        break;
    }
    update.mutate({ id: template.id, name: name.trim(), config });
  }

  const isVoice = template.type === "VOICE_AI" || template.type === "VOICE_PRERECORDED";
  const isLoading = !seeded && query.isLoading;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t("agents.actions.edit")}: ${template.name}`}
      confirmLabel={update.isPending ? "…" : t("agents.form.save")}
      onConfirm={handleSave}
    >
      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <p className="text-sm text-slate-400">…</p>
        ) : (
          <>
            <InputGroup
              label={t("agents.form.name")}
              id="e-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
              <span className="font-medium">{t("agents.form.type")}:</span>{" "}
              {t(`agents.type.${template.type}` as Parameters<typeof t>[0])}
            </div>

            {isVoice && (
              <>
                <SelectGroup
                  label={t("agents.form.language")}
                  id="e-lang"
                  value={fields.language ?? "es"}
                  onChange={(e) => set("language", e.target.value)}
                >
                  {(["es", "en"] as const).map((lng) => (
                    <option key={lng} value={lng}>
                      {t(`agents.lang.${lng}` as Parameters<typeof t>[0])}
                    </option>
                  ))}
                </SelectGroup>
                <SelectGroup
                  label={t("agents.form.voice")}
                  id="e-voice"
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

            {template.type === "VOICE_AI" && (
              <>
                <InputGroup
                  label={t("agents.form.firstMessage")}
                  id="e-first"
                  value={fields.firstMessage ?? ""}
                  onChange={(e) => set("firstMessage", e.target.value)}
                />
                <TextareaGroup
                  label={t("agents.form.systemPrompt")}
                  id="e-prompt"
                  value={fields.systemPrompt ?? ""}
                  onChange={(e) => set("systemPrompt", e.target.value)}
                />
              </>
            )}

            {template.type === "VOICE_PRERECORDED" && (
              <TextareaGroup
                label={t("agents.form.script")}
                id="e-script"
                value={fields.script ?? ""}
                onChange={(e) => set("script", e.target.value)}
              />
            )}

            {template.type === "SMS" && (
              <>
                <TextareaGroup
                  label={t("agents.form.messageBody")}
                  id="e-sms"
                  value={fields.messageBody ?? ""}
                  onChange={(e) => set("messageBody", e.target.value)}
                />
                <InputGroup
                  label={t("agents.form.senderId")}
                  id="e-sender"
                  value={fields.senderId ?? ""}
                  onChange={(e) => set("senderId", e.target.value)}
                />
              </>
            )}

            {template.type === "EMAIL" && (
              <>
                <InputGroup
                  label={t("agents.form.subject")}
                  id="e-subject"
                  value={fields.subject ?? ""}
                  onChange={(e) => set("subject", e.target.value)}
                />
                <TextareaGroup
                  label={t("agents.form.messageBody")}
                  id="e-email-body"
                  value={fields.messageBody ?? ""}
                  onChange={(e) => set("messageBody", e.target.value)}
                />
                <TextareaGroup
                  label={t("agents.form.systemPrompt")}
                  id="e-email-prompt"
                  value={fields.systemPrompt ?? ""}
                  onChange={(e) => set("systemPrompt", e.target.value)}
                />
                <InputGroup
                  label={t("agents.form.maxReplies")}
                  id="e-email-maxreplies"
                  type="number"
                  placeholder={String(DEFAULT_MAX_REPLIES)}
                  value={fields.maxReplies ?? ""}
                  onChange={(e) => set("maxReplies", e.target.value)}
                />
              </>
            )}

            {template.type === "WHATSAPP" && (
              <>
                {!integration.data?.connected && !integration.isLoading && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {t("agents.form.noIntegrationWarning")}
                  </p>
                )}
                <InputGroup
                  label={t("agents.form.templateName")}
                  id="e-wa-tname"
                  value={fields.templateName ?? ""}
                  onChange={(e) => set("templateName", e.target.value)}
                />
                <TextareaGroup
                  label={t("agents.form.templatePreview")}
                  id="e-wa-body"
                  readOnly
                  value={
                    preview.isFetching
                      ? t("agents.form.templatePreviewLoading")
                      : (fields.messageBody ?? "")
                  }
                  onChange={() => undefined}
                  className="text-slate-500"
                />
                {preview.isError && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-red-600">{t("agents.form.templatePreviewError")}</p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => preview.refetch()}
                    >
                      {t("common.retry")}
                    </Button>
                  </div>
                )}
                {!preview.isFetching &&
                  !preview.isError &&
                  preview.isFetched &&
                  preview.data === null &&
                  integration.data?.connected && (
                    <p className="text-xs text-amber-700">{t("agents.form.templateNotFound")}</p>
                  )}
                <TextareaGroup
                  label={t("agents.form.systemPrompt")}
                  id="e-wa-prompt"
                  value={fields.systemPrompt ?? ""}
                  onChange={(e) => set("systemPrompt", e.target.value)}
                />
                <InputGroup
                  label={t("agents.form.maxReplies")}
                  id="e-wa-maxreplies"
                  type="number"
                  placeholder={String(DEFAULT_MAX_REPLIES)}
                  value={fields.maxReplies ?? ""}
                  onChange={(e) => set("maxReplies", e.target.value)}
                />
              </>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
          </>
        )}
      </div>
    </Dialog>
  );
}
