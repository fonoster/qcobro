import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildOutreachContext,
  calculateSmsSegments,
  DEFAULT_VOICE_IDLE_OPTIONS,
  normalizeForGsm7,
  renderTemplate,
  voicePrerecordedDtmfSchema
} from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useI18n, type MessageId } from "../lib/i18n.js";
import { SAMPLE_ACCOUNT } from "../lib/sampleAccount.js";
import { useWorkspaceCurrency, useWorkspaceLocale } from "../lib/useWorkspaceCurrency.js";
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

/**
 * Example text for the non-obvious agent-template fields (issue #118). Defined once and
 * consumed by both the create and edit modals so the two can't drift. Every example is
 * shown inside its own field as the placeholder, the way the design system draws it.
 */
const FIELD_PLACEHOLDER = {
  firstMessage: "agents.form.firstMessagePlaceholder",
  systemPrompt: "agents.form.systemPromptPlaceholder",
  script: "agents.form.scriptPlaceholder",
  messageBody: "agents.form.messageBodyPlaceholder",
  idleMessage: "agents.form.idleMessagePlaceholder",
  repeatDigit: "agents.form.repeatDigitPlaceholder",
  repeatMessage: "agents.form.repeatMessagePlaceholder",
  maxRepeats: "agents.form.maxRepeatsPlaceholder",
  optOutDigit: "agents.form.optOutDigitPlaceholder",
  optOutMessage: "agents.form.optOutMessagePlaceholder",
  optOutConfirmationMessage: "agents.form.optOutConfirmationMessagePlaceholder",
  subject: "agents.form.subjectPlaceholder",
  templateName: "agents.form.templateNamePlaceholder",
  senderId: "agents.form.senderIdPlaceholder",
  idleTimeout: "agents.form.idleTimeoutPlaceholder",
  idleMaxTimeoutCount: "agents.form.idleMaxTimeoutCountPlaceholder"
} as const satisfies Record<string, MessageId>;

/** Example template variables + a link to the full reference, under the page header. */
function VariablesHint() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium text-fg-subtle">{t("agents.vars.label")}</span>
      {EXAMPLE_VARS.map((v) => (
        <code
          key={v}
          className="rounded-md bg-elevated px-2 py-0.5 font-mono text-xs text-fg-muted"
        >
          {v}
        </code>
      ))}
      <span className="text-fg-subtle">·</span>
      <a
        href={VARS_DOC_URL}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary underline"
      >
        {t("agents.vars.link")}
      </a>
    </div>
  );
}

/**
 * The SMS-specific fields: the message body, a live estimate of what it will cost to send,
 * and the opt-in that brings that cost down. Defined once and used by both the create and
 * edit modals, which are otherwise duplicated JSX.
 *
 * The estimate counts **sample-rendered** text, not the raw template. `{{outstandingBalance}}`
 * is 21 characters where `9,500` is five, and — more importantly — it is usually a
 * substituted value, not the template's own words, that pushes a message out of the GSM 7-bit
 * alphabet and halves the per-segment budget. Counting the raw template would report a number
 * that is both wrong and blind to the case worth warning about. It is an estimate, because a
 * real account's name and balance differ from the sample's, hence the `≈`.
 *
 * The count is rendered as a sibling of the field: the field itself already carries the
 * `{{variable}}` example as its placeholder.
 */
function SmsFields({
  idPrefix,
  messageBody,
  senderId,
  normalizeGsm7,
  onChange,
  onNormalizeChange
}: {
  idPrefix: string;
  messageBody: string;
  senderId: string;
  normalizeGsm7: boolean;
  onChange: (key: string, value: string) => void;
  onNormalizeChange: (value: boolean) => void;
}) {
  const { t } = useI18n();
  const locale = useWorkspaceLocale();
  const currency = useWorkspaceCurrency();

  const rendered = messageBody
    ? renderTemplate(messageBody, buildOutreachContext(SAMPLE_ACCOUNT, { currency, locale }))
    : "";
  // A malformed template renders as a visible `[Error de plantilla: …]` marker rather than
  // throwing. That marker is not message content, so it must not be counted.
  const countable = rendered.startsWith("[") ? "" : rendered;
  const seg = countable
    ? calculateSmsSegments(normalizeGsm7 ? normalizeForGsm7(countable) : countable)
    : null;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <TextareaGroup
          label={t("agents.form.messageBody")}
          id={`${idPrefix}-sms`}
          placeholder={t(FIELD_PLACEHOLDER.messageBody)}
          value={messageBody}
          onChange={(e) => onChange("messageBody", e.target.value)}
        />
        {seg && (
          <p className="text-xs text-fg-subtle">
            {t(seg.segmentCount === 1 ? "agents.form.smsSegmentOne" : "agents.form.smsSegments")
              .replace("{segments}", String(seg.segmentCount))
              .replace("{characters}", String(seg.characterCount))}
            {seg.nonGsmCharacters.length > 0 &&
              ` · ${t("agents.form.smsCostlyChars").replace(
                "{characters}",
                seg.nonGsmCharacters.join(" ")
              )}`}
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <input
          type="checkbox"
          id={`${idPrefix}-gsm7`}
          checked={normalizeGsm7}
          onChange={(e) => onNormalizeChange(e.target.checked)}
          className="size-4 accent-primary"
        />
        {t("agents.form.normalizeGsm7")}
      </label>
      <InputGroup
        label={t("agents.form.senderId")}
        id={`${idPrefix}-sender`}
        placeholder={t(FIELD_PLACEHOLDER.senderId)}
        value={senderId}
        onChange={(e) => onChange("senderId", e.target.value)}
      />
    </>
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
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
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
            // Without this, reopening Editar right after a save can show the pre-save
            // values: `get` is keyed by this template's id and nothing else invalidates it,
            // so the cached response from the last time this modal was open wins the race
            // against a fresh fetch until it separately goes stale on its own.
            utils.agentTemplates.get.invalidate({ id: editing.id });
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

type DtmfFieldErrors = Partial<
  Record<
    "repeatDigit" | "repeatMessage" | "optOutDigit" | "optOutMessage" | "optOutConfirmationMessage",
    string
  >
>;

/**
 * Client-side validation for the DTMF menu, inline so an operator sees the problem before
 * submitting rather than only via the server's rejection. Delegates the actual rules (message
 * required exactly when its digit is set, the two digits must differ, a digit is a single
 * `0`-`9` character) to `voicePrerecordedDtmfSchema` — the same schema the server validates
 * against — so this can only ever drift out of sync with the server on message wording, never
 * on which inputs are accepted.
 */
function validateVoicePrerecordedDtmf(
  fields: Record<string, string>,
  t: (id: MessageId) => string
): DtmfFieldErrors {
  const result = voicePrerecordedDtmfSchema.safeParse({
    repeatDigit: fields.repeatDigit || undefined,
    repeatMessage: fields.repeatMessage || undefined,
    maxRepeats: fields.maxRepeats ? Number(fields.maxRepeats) : undefined,
    optOutDigit: fields.optOutDigit || undefined,
    optOutMessage: fields.optOutMessage || undefined,
    optOutConfirmationMessage: fields.optOutConfirmationMessage || undefined
  });
  if (result.success) return {};

  const errors: DtmfFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (
      field !== "repeatDigit" &&
      field !== "repeatMessage" &&
      field !== "optOutDigit" &&
      field !== "optOutMessage" &&
      field !== "optOutConfirmationMessage"
    ) {
      continue;
    }
    if (issue.message.includes("must differ")) {
      errors[field] = t("agents.form.dtmfDigitsMustDiffer");
    } else if (issue.message.includes("single digit")) {
      errors[field] = t("agents.form.dtmfDigitFormat");
    } else if (
      field === "repeatMessage" ||
      field === "optOutMessage" ||
      field === "optOutConfirmationMessage"
    ) {
      errors[field] = t("agents.form.dtmfMessageRequired");
    } else {
      errors[field] = t("agents.form.dtmfDigitRequired");
    }
  }
  return errors;
}

/**
 * VOICE_AI idle options must be a non-empty message, a timeout of at least 3000 ms, and a
 * max-timeout count of at least 1 — mirrors the `createAgentTemplateSchema` bounds so an
 * invalid submit is caught before the request. The fields are pre-filled from the
 * deployment default, so this only fails if the operator clears or lowers a value.
 */
function isValidIdleConfig(fields: Record<string, string>): boolean {
  const timeout = Number(fields.idleTimeout);
  const maxCount = Number(fields.idleMaxTimeoutCount);
  return (
    (fields.idleMessage ?? "").trim().length > 0 &&
    Number.isInteger(timeout) &&
    timeout >= 3000 &&
    Number.isInteger(maxCount) &&
    maxCount >= 1
  );
}

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
  // Boolean, so it lives beside `name`/`type` rather than in the string-valued `fields` bag.
  const [normalizeGsm7, setNormalizeGsm7] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({
    language: "es",
    // Idle options pre-filled from the deployment default; the operator may override.
    idleMessage: DEFAULT_VOICE_IDLE_OPTIONS.message,
    idleTimeout: String(DEFAULT_VOICE_IDLE_OPTIONS.timeout),
    idleMaxTimeoutCount: String(DEFAULT_VOICE_IDLE_OPTIONS.maxTimeoutCount)
  });
  const [error, setError] = useState<string | null>(null);
  const createDtmfErrors = validateVoicePrerecordedDtmf(fields, t);
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
    if (type === "VOICE_PRERECORDED" && Object.keys(createDtmfErrors).length > 0) {
      // Each error already renders inline next to its field (see `error={createDtmfErrors...}`
      // below) — no need to repeat it in the generic banner too.
      return;
    }
    if (type === "VOICE_AI" && !isValidIdleConfig(fields)) {
      setError(t("agents.form.idleInvalid"));
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
          language: fields.language ?? "es",
          idleMessage: fields.idleMessage ?? "",
          idleTimeout: Number(fields.idleTimeout),
          idleMaxTimeoutCount: Number(fields.idleMaxTimeoutCount)
        };
        break;
      case "VOICE_PRERECORDED":
        payload = {
          ...base,
          type,
          voice: fields.voice ?? "",
          script: fields.script ?? "",
          language: fields.language ?? "es",
          ...(fields.repeatDigit ? { repeatDigit: fields.repeatDigit } : {}),
          ...(fields.repeatMessage ? { repeatMessage: fields.repeatMessage } : {}),
          ...(fields.maxRepeats ? { maxRepeats: Number(fields.maxRepeats) } : {}),
          ...(fields.optOutDigit ? { optOutDigit: fields.optOutDigit } : {}),
          ...(fields.optOutMessage ? { optOutMessage: fields.optOutMessage } : {}),
          ...(fields.optOutConfirmationMessage
            ? { optOutConfirmationMessage: fields.optOutConfirmationMessage }
            : {})
        };
        break;
      case "SMS":
        payload = {
          ...base,
          type,
          messageBody: fields.messageBody ?? "",
          ...(fields.senderId ? { senderId: fields.senderId } : {}),
          ...(normalizeGsm7 ? { normalizeGsm7: true } : {})
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
      cancelLabel={t("common.cancel")}
      onConfirm={handleCreate}
      error={error}
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
              placeholder={t(FIELD_PLACEHOLDER.firstMessage)}
              value={fields.firstMessage ?? ""}
              onChange={(e) => set("firstMessage", e.target.value)}
            />
            <TextareaGroup
              label={t("agents.form.systemPrompt")}
              id="a-prompt"
              placeholder={t(FIELD_PLACEHOLDER.systemPrompt)}
              value={fields.systemPrompt ?? ""}
              onChange={(e) => set("systemPrompt", e.target.value)}
            />
            <TextareaGroup
              label={t("agents.form.idleMessage")}
              id="a-idle-message"
              placeholder={t(FIELD_PLACEHOLDER.idleMessage)}
              value={fields.idleMessage ?? ""}
              onChange={(e) => set("idleMessage", e.target.value)}
            />
            <InputGroup
              label={t("agents.form.idleTimeout")}
              id="a-idle-timeout"
              type="number"
              min={3000}
              placeholder={t(FIELD_PLACEHOLDER.idleTimeout)}
              value={fields.idleTimeout ?? ""}
              onChange={(e) => set("idleTimeout", e.target.value)}
            />
            <InputGroup
              label={t("agents.form.idleMaxTimeoutCount")}
              id="a-idle-max"
              type="number"
              min={1}
              placeholder={t(FIELD_PLACEHOLDER.idleMaxTimeoutCount)}
              value={fields.idleMaxTimeoutCount ?? ""}
              onChange={(e) => set("idleMaxTimeoutCount", e.target.value)}
            />
          </>
        )}

        {type === "VOICE_PRERECORDED" && (
          <>
            <TextareaGroup
              label={t("agents.form.script")}
              id="a-script"
              placeholder={t(FIELD_PLACEHOLDER.script)}
              value={fields.script ?? ""}
              onChange={(e) => set("script", e.target.value)}
            />
            <div className="flex flex-col gap-1 pt-2">
              <p className="text-sm font-semibold text-fg">{t("agents.form.dtmfSectionTitle")}</p>
              <p className="text-xs text-fg-subtle">{t("agents.form.dtmfSectionDescription")}</p>
            </div>
            <InputGroup
              label={t("agents.form.repeatDigit")}
              id="a-repeat-digit"
              maxLength={1}
              placeholder={t(FIELD_PLACEHOLDER.repeatDigit)}
              value={fields.repeatDigit ?? ""}
              onChange={(e) => set("repeatDigit", e.target.value)}
              error={createDtmfErrors.repeatDigit}
            />
            <TextareaGroup
              label={t("agents.form.repeatMessage")}
              id="a-repeat-message"
              placeholder={t(FIELD_PLACEHOLDER.repeatMessage)}
              value={fields.repeatMessage ?? ""}
              onChange={(e) => set("repeatMessage", e.target.value)}
              error={createDtmfErrors.repeatMessage}
            />
            <InputGroup
              label={t("agents.form.maxRepeats")}
              id="a-max-repeats"
              type="number"
              min={1}
              placeholder={t(FIELD_PLACEHOLDER.maxRepeats)}
              value={fields.maxRepeats ?? ""}
              onChange={(e) => set("maxRepeats", e.target.value)}
            />
            <InputGroup
              label={t("agents.form.optOutDigit")}
              id="a-optout-digit"
              maxLength={1}
              placeholder={t(FIELD_PLACEHOLDER.optOutDigit)}
              value={fields.optOutDigit ?? ""}
              onChange={(e) => set("optOutDigit", e.target.value)}
              error={createDtmfErrors.optOutDigit}
            />
            <TextareaGroup
              label={t("agents.form.optOutMessage")}
              id="a-optout-message"
              placeholder={t(FIELD_PLACEHOLDER.optOutMessage)}
              value={fields.optOutMessage ?? ""}
              onChange={(e) => set("optOutMessage", e.target.value)}
              error={createDtmfErrors.optOutMessage}
            />
            <TextareaGroup
              label={t("agents.form.optOutConfirmationMessage")}
              id="a-optout-confirmation"
              placeholder={t(FIELD_PLACEHOLDER.optOutConfirmationMessage)}
              value={fields.optOutConfirmationMessage ?? ""}
              onChange={(e) => set("optOutConfirmationMessage", e.target.value)}
              error={createDtmfErrors.optOutConfirmationMessage}
            />
          </>
        )}

        {type === "SMS" && (
          <SmsFields
            idPrefix="a"
            messageBody={fields.messageBody ?? ""}
            senderId={fields.senderId ?? ""}
            normalizeGsm7={normalizeGsm7}
            onChange={set}
            onNormalizeChange={setNormalizeGsm7}
          />
        )}

        {type === "EMAIL" && (
          <>
            <InputGroup
              label={t("agents.form.subject")}
              id="a-subject"
              placeholder={t(FIELD_PLACEHOLDER.subject)}
              value={fields.subject ?? ""}
              onChange={(e) => set("subject", e.target.value)}
            />
            <TextareaGroup
              label={t("agents.form.messageBody")}
              id="a-email-body"
              placeholder={t(FIELD_PLACEHOLDER.messageBody)}
              value={fields.messageBody ?? ""}
              onChange={(e) => set("messageBody", e.target.value)}
            />
            <TextareaGroup
              label={t("agents.form.systemPrompt")}
              id="a-email-prompt"
              placeholder={t(FIELD_PLACEHOLDER.systemPrompt)}
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
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                {t("agents.form.noIntegrationWarning")}
              </p>
            )}
            <InputGroup
              label={t("agents.form.templateName")}
              id="a-wa-tname"
              placeholder={t(FIELD_PLACEHOLDER.templateName)}
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
              className="text-fg-subtle"
            />
            {preview.isError && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-danger">{t("agents.form.templatePreviewError")}</p>
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
                <p className="text-xs text-warning">{t("agents.form.templateNotFound")}</p>
              )}
            <TextareaGroup
              label={t("agents.form.systemPrompt")}
              id="a-wa-prompt"
              placeholder={t(FIELD_PLACEHOLDER.systemPrompt)}
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
  smsConfig: (Record<string, unknown> & { normalizeGsm7?: boolean }) | null;
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
  // Boolean, so it can't ride along in the string-valued `fields` bag.
  const [normalizeGsm7, setNormalizeGsm7] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editDtmfErrors = validateVoicePrerecordedDtmf(fields, t);
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
    setNormalizeGsm7(full.smsConfig?.normalizeGsm7 ?? false);
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
    if (template.type === "VOICE_PRERECORDED" && Object.keys(editDtmfErrors).length > 0) {
      // Each error already renders inline next to its field — no need to repeat it below.
      return;
    }
    if (template.type === "VOICE_AI" && !isValidIdleConfig(fields)) {
      setError(t("agents.form.idleInvalid"));
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
          language: fields.language,
          idleMessage: fields.idleMessage,
          idleTimeout: Number(fields.idleTimeout),
          idleMaxTimeoutCount: Number(fields.idleMaxTimeoutCount)
        };
        break;
      case "VOICE_PRERECORDED":
        config = {
          voice: fields.voice,
          script: fields.script,
          language: fields.language,
          // Sent explicitly (including null) rather than omitted-when-falsy: `fields` is
          // always fully seeded from the current config on load, so this is the one place
          // an operator can actually clear a previously-set digit/message and disable the
          // menu — omitting empty values here would silently keep the old ones in the DB.
          repeatDigit: fields.repeatDigit || null,
          repeatMessage: fields.repeatMessage || null,
          maxRepeats: fields.maxRepeats ? Number(fields.maxRepeats) : null,
          optOutDigit: fields.optOutDigit || null,
          optOutMessage: fields.optOutMessage || null,
          optOutConfirmationMessage: fields.optOutConfirmationMessage || null
        };
        break;
      case "SMS":
        config = {
          messageBody: fields.messageBody,
          ...(fields.senderId ? { senderId: fields.senderId } : {}),
          // Always sent, not omitted-when-false, so an operator can actually turn it off.
          normalizeGsm7
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
      cancelLabel={t("common.cancel")}
      onConfirm={handleSave}
      error={error}
    >
      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <p className="text-sm text-fg-subtle">…</p>
        ) : (
          <>
            <InputGroup
              label={t("agents.form.name")}
              id="e-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="rounded-md bg-elevated px-3 py-2 text-sm text-fg-subtle">
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
                  placeholder={t(FIELD_PLACEHOLDER.firstMessage)}
                  value={fields.firstMessage ?? ""}
                  onChange={(e) => set("firstMessage", e.target.value)}
                />
                <TextareaGroup
                  label={t("agents.form.systemPrompt")}
                  id="e-prompt"
                  placeholder={t(FIELD_PLACEHOLDER.systemPrompt)}
                  value={fields.systemPrompt ?? ""}
                  onChange={(e) => set("systemPrompt", e.target.value)}
                />
                <TextareaGroup
                  label={t("agents.form.idleMessage")}
                  id="e-idle-message"
                  placeholder={t(FIELD_PLACEHOLDER.idleMessage)}
                  value={fields.idleMessage ?? ""}
                  onChange={(e) => set("idleMessage", e.target.value)}
                />
                <InputGroup
                  label={t("agents.form.idleTimeout")}
                  id="e-idle-timeout"
                  type="number"
                  min={3000}
                  placeholder={t(FIELD_PLACEHOLDER.idleTimeout)}
                  value={fields.idleTimeout ?? ""}
                  onChange={(e) => set("idleTimeout", e.target.value)}
                />
                <InputGroup
                  label={t("agents.form.idleMaxTimeoutCount")}
                  id="e-idle-max"
                  type="number"
                  min={1}
                  placeholder={t(FIELD_PLACEHOLDER.idleMaxTimeoutCount)}
                  value={fields.idleMaxTimeoutCount ?? ""}
                  onChange={(e) => set("idleMaxTimeoutCount", e.target.value)}
                />
              </>
            )}

            {template.type === "VOICE_PRERECORDED" && (
              <>
                <TextareaGroup
                  label={t("agents.form.script")}
                  id="e-script"
                  placeholder={t(FIELD_PLACEHOLDER.script)}
                  value={fields.script ?? ""}
                  onChange={(e) => set("script", e.target.value)}
                />
                <div className="flex flex-col gap-1 pt-2">
                  <p className="text-sm font-semibold text-fg">
                    {t("agents.form.dtmfSectionTitle")}
                  </p>
                  <p className="text-xs text-fg-subtle">
                    {t("agents.form.dtmfSectionDescription")}
                  </p>
                </div>
                <InputGroup
                  label={t("agents.form.repeatDigit")}
                  id="e-repeat-digit"
                  maxLength={1}
                  placeholder={t(FIELD_PLACEHOLDER.repeatDigit)}
                  value={fields.repeatDigit ?? ""}
                  onChange={(e) => set("repeatDigit", e.target.value)}
                  error={editDtmfErrors.repeatDigit}
                />
                <TextareaGroup
                  label={t("agents.form.repeatMessage")}
                  id="e-repeat-message"
                  placeholder={t(FIELD_PLACEHOLDER.repeatMessage)}
                  value={fields.repeatMessage ?? ""}
                  onChange={(e) => set("repeatMessage", e.target.value)}
                  error={editDtmfErrors.repeatMessage}
                />
                <InputGroup
                  label={t("agents.form.maxRepeats")}
                  id="e-max-repeats"
                  type="number"
                  min={1}
                  placeholder={t(FIELD_PLACEHOLDER.maxRepeats)}
                  value={fields.maxRepeats ?? ""}
                  onChange={(e) => set("maxRepeats", e.target.value)}
                />
                <InputGroup
                  label={t("agents.form.optOutDigit")}
                  id="e-optout-digit"
                  maxLength={1}
                  placeholder={t(FIELD_PLACEHOLDER.optOutDigit)}
                  value={fields.optOutDigit ?? ""}
                  onChange={(e) => set("optOutDigit", e.target.value)}
                  error={editDtmfErrors.optOutDigit}
                />
                <TextareaGroup
                  label={t("agents.form.optOutMessage")}
                  id="e-optout-message"
                  placeholder={t(FIELD_PLACEHOLDER.optOutMessage)}
                  value={fields.optOutMessage ?? ""}
                  onChange={(e) => set("optOutMessage", e.target.value)}
                  error={editDtmfErrors.optOutMessage}
                />
                <TextareaGroup
                  label={t("agents.form.optOutConfirmationMessage")}
                  id="e-optout-confirmation"
                  placeholder={t(FIELD_PLACEHOLDER.optOutConfirmationMessage)}
                  value={fields.optOutConfirmationMessage ?? ""}
                  onChange={(e) => set("optOutConfirmationMessage", e.target.value)}
                  error={editDtmfErrors.optOutConfirmationMessage}
                />
              </>
            )}

            {template.type === "SMS" && (
              <SmsFields
                idPrefix="e"
                messageBody={fields.messageBody ?? ""}
                senderId={fields.senderId ?? ""}
                normalizeGsm7={normalizeGsm7}
                onChange={set}
                onNormalizeChange={setNormalizeGsm7}
              />
            )}

            {template.type === "EMAIL" && (
              <>
                <InputGroup
                  label={t("agents.form.subject")}
                  id="e-subject"
                  placeholder={t(FIELD_PLACEHOLDER.subject)}
                  value={fields.subject ?? ""}
                  onChange={(e) => set("subject", e.target.value)}
                />
                <TextareaGroup
                  label={t("agents.form.messageBody")}
                  id="e-email-body"
                  placeholder={t(FIELD_PLACEHOLDER.messageBody)}
                  value={fields.messageBody ?? ""}
                  onChange={(e) => set("messageBody", e.target.value)}
                />
                <TextareaGroup
                  label={t("agents.form.systemPrompt")}
                  id="e-email-prompt"
                  placeholder={t(FIELD_PLACEHOLDER.systemPrompt)}
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
                  <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                    {t("agents.form.noIntegrationWarning")}
                  </p>
                )}
                <InputGroup
                  label={t("agents.form.templateName")}
                  id="e-wa-tname"
                  placeholder={t(FIELD_PLACEHOLDER.templateName)}
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
                  className="text-fg-subtle"
                />
                {preview.isError && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-danger">{t("agents.form.templatePreviewError")}</p>
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
                    <p className="text-xs text-warning">{t("agents.form.templateNotFound")}</p>
                  )}
                <TextareaGroup
                  label={t("agents.form.systemPrompt")}
                  id="e-wa-prompt"
                  placeholder={t(FIELD_PLACEHOLDER.systemPrompt)}
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
          </>
        )}
      </div>
    </Dialog>
  );
}
