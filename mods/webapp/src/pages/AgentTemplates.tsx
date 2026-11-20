import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildOutreachContext,
  calculateSmsSegments,
  DEFAULT_VOICE_IDLE_OPTIONS,
  DEFAULT_VOICE_LANGUAGE,
  MULTILINGUAL_LANGUAGE,
  normalizeForGsm7,
  renderTemplate,
  voicePrerecordedDtmfSchema
} from "@qcobro/common";
import { Archive, Bot, Braces, Lock, Plus } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { channelIcon } from "../lib/channelIcon.js";
import { useI18n, type MessageId } from "../lib/i18n.js";
import { formatRelativeDate } from "../lib/relativeDate.js";
import { SAMPLE_ACCOUNT } from "../lib/sampleAccount.js";
import { useWorkspaceCurrency, useWorkspaceLocale } from "../lib/useWorkspaceCurrency.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable } from "../components/ui/data-table.js";
import { Dialog } from "../components/ui/dialog.js";
import { Drawer } from "../components/ui/drawer.js";
import type { OverlayChromeProps } from "../components/ui/overlay.js";
import { ChoiceCardGroup } from "../components/ui/choice-cards.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { FilterChip } from "../components/ui/filter-chip.js";
import { Field } from "../components/ui/field.js";
import { Alert } from "../components/ui/alert.js";
import { Button } from "../components/ui/button.js";
import { Checkbox } from "../components/ui/checkbox.js";
import { InputGroup, SearchBox } from "../components/ui/input.js";
import { Switch } from "../components/ui/switch.js";
import { TextareaGroup } from "../components/ui/textarea.js";
import { SelectGroup } from "../components/ui/select.js";
import { Badge } from "../components/ui/badge.js";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";

export type AgentType = "VOICE_AI" | "VOICE_PRERECORDED" | "SMS" | "EMAIL" | "WHATSAPP";

type Template = {
  id: string;
  name: string;
  type: AgentType;
  archivedAt: Date | string | null;
  createdAt: Date | string;
};

/** What the edit overlay needs to open: the rest it fetches. */
export type EditableTemplate = { id: string; name: string; type: AgentType };

const TYPE_FILTERS: AgentType[] = ["VOICE_AI", "VOICE_PRERECORDED", "SMS", "EMAIL", "WHATSAPP"];

/** Rows per page in the list. */
const PAGE_SIZE = 10;

/** Mirrors the deployment default (`resend`/`whatsapp` config's `maxRepliesDefault`). */
const DEFAULT_MAX_REPLIES = 3;

/** Documentation listing every supported template variable. */
const VARS_DOC_URL = "https://docs.qcobro.com/guides/agent-templates#variables-disponibles";
const EXAMPLE_VARS = ["{{firstName}}", "{{principalAmount}}", "{{outstandingBalance}}"];

/**
 * Example text for the non-obvious agent-template fields (issue #118). Defined once and
 * consumed by both the create and edit overlays so the two can't drift. Every example is
 * shown inside its own field as the placeholder, the way the design system draws it.
 *
 * Only some of these fields are template-rendered, and an example must not suggest
 * otherwise. `dispatchOutreach` runs `renderTemplate` over the SMS/EMAIL body, the EMAIL
 * subject, the pre-recorded `script`, and the Voz IA `firstMessage` — those examples may
 * carry a `{{variable}}`. It never runs over `systemPrompt` or `idleMessage`: both are
 * stored verbatim on the synced Fonoster application (`syncVoiceApplication`), one per
 * agent rather than one per account, so a `{{variable}}` there would reach the model as
 * literal braces. The account's figures arrive on their own — as the metadata block
 * `toCallMetadata` builds for voice, and as the `Contexto` line
 * `buildAutopilotContextLines` builds for the EMAIL/WhatsApp autopilots.
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

function typeIcon(type: AgentType): React.ReactNode {
  const Icon = channelIcon(type);
  return <Icon />;
}

export const TYPE_ICON: Record<AgentType, React.ReactNode> = {
  VOICE_AI: typeIcon("VOICE_AI"),
  VOICE_PRERECORDED: typeIcon("VOICE_PRERECORDED"),
  SMS: typeIcon("SMS"),
  WHATSAPP: typeIcon("WHATSAPP"),
  EMAIL: typeIcon("EMAIL")
};

/** Example template variables + a link to the full reference, under the list. */
function VariablesHint() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs text-fg-muted">
      <Braces aria-hidden className="h-3.5 w-3.5" />
      <span>{t("agents.vars.label")}</span>
      {EXAMPLE_VARS.map((v) => (
        <code key={v} className="rounded-md bg-elevated px-2 py-[3px] font-mono text-xs text-fg">
          {v}
        </code>
      ))}
      <a
        href={VARS_DOC_URL}
        target="_blank"
        rel="noreferrer"
        className="text-fg-muted underline-offset-2 hover:text-fg hover:underline"
      >
        {t("agents.vars.link")}
      </a>
    </div>
  );
}

/**
 * The SMS-specific fields: the message body with a live estimate of what it will cost to
 * send (at the label row's end), the opt-in that brings that cost down, and the sender ID.
 *
 * The estimate counts **sample-rendered** text, not the raw template. `{{outstandingBalance}}`
 * is 21 characters where `9,500` is five, and — more importantly — it is usually a
 * substituted value, not the template's own words, that pushes a message out of the GSM 7-bit
 * alphabet and halves the per-segment budget. Counting the raw template would report a number
 * that is both wrong and blind to the case worth warning about. It is an estimate, because a
 * real account's name and balance differ from the sample's, hence the `≈`.
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
  // An empty body still shows the counter, at zero, so the label row matches the design.
  const seg = countable
    ? calculateSmsSegments(normalizeGsm7 ? normalizeForGsm7(countable) : countable)
    : { segmentCount: 0, characterCount: 0, nonGsmCharacters: [] as string[] };

  const estimate =
    t(seg.segmentCount === 1 ? "agents.form.smsSegmentOne" : "agents.form.smsSegments")
      .replace("{segments}", String(seg.segmentCount))
      .replace("{characters}", String(seg.characterCount)) +
    (seg.nonGsmCharacters.length > 0
      ? ` · ${t("agents.form.smsCostlyChars").replace(
          "{characters}",
          seg.nonGsmCharacters.join(" ")
        )}`
      : "");

  return (
    <>
      <TextareaGroup
        label={t("agents.form.messageBody")}
        labelEnd={estimate}
        id={`${idPrefix}-sms`}
        rows={4}
        placeholder={t(FIELD_PLACEHOLDER.messageBody)}
        value={messageBody}
        onChange={(e) => onChange("messageBody", e.target.value)}
      />
      <Checkbox
        id={`${idPrefix}-gsm7`}
        label={t("agents.form.normalizeGsm7")}
        description={t("agents.form.normalizeGsm7Description")}
        checked={normalizeGsm7}
        onChange={(e) => onNormalizeChange(e.target.checked)}
      />
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
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [typeFilter, setTypeFilter] = useState<"" | AgentType>("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<AgentType | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [archiving, setArchiving] = useState<Template | null>(null);

  const { data, isLoading } = trpc.agentTemplates.list.useQuery({
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(includeArchived ? { includeArchived: true } : {})
  });
  const templates: Template[] = (data ?? []) as Template[];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? templates.filter((tp) => tp.name.toLowerCase().includes(q)) : templates;
  }, [templates, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function invalidate() {
    utils.agentTemplates.list.invalidate();
  }

  const setArchived = trpc.agentTemplates.update.useMutation({
    onSuccess: (_d, vars) => {
      setArchiving(null);
      invalidate();
      utils.agentTemplates.get.invalidate({ id: vars.id });
    }
  });

  const newAgentButton = (
    <Button onClick={() => setShowCreate(true)}>
      <Plus className="h-4 w-4" />
      {t("agents.new")}
    </Button>
  );

  // Nothing to list and nothing narrowing it: the first-run empty state, no toolbar.
  const isFirstRun =
    !isLoading && templates.length === 0 && !typeFilter && !includeArchived && !search;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("agents.title")}
        description={t("agents.description")}
        actions={newAgentButton}
      />

      {isFirstRun ? (
        <EmptyState
          icon={<Bot />}
          title={t("agents.empty.title")}
          body={t("agents.empty.body")}
          action={newAgentButton}
        />
      ) : (
        <DataTable
          data={pageRows}
          keyField="id"
          searchable={false}
          filterElement={
            <div className="flex items-center gap-3">
              <SearchBox
                placeholder={t("agents.searchPlaceholder")}
                aria-label={t("agents.searchPlaceholder")}
                className="w-80"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <FilterChip
                label={t("agents.filter.channel")}
                value={typeFilter}
                allValue=""
                options={[
                  { value: "", label: t("agents.filter.all") },
                  ...TYPE_FILTERS.map((tp) => ({
                    value: tp,
                    label: t(`agents.type.${tp}` as MessageId)
                  }))
                ]}
                onChange={(v) => {
                  setTypeFilter(v as "" | AgentType);
                  setPage(1);
                }}
              />
              <div className="pl-1">
                <Switch
                  id="agents-show-archived"
                  label={t("agents.filter.showArchived")}
                  checked={includeArchived}
                  onChange={(e) => {
                    setIncludeArchived(e.target.checked);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          }
          countLabel={t("agents.countLabel")}
          rowHeight={64}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          totalRecords={filtered.length}
          pageSize={PAGE_SIZE}
          itemLabel={t("agents.countLabel")}
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
              width: 170,
              render: (r) => (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-fg-muted">
                  {TYPE_ICON[r.type]}
                  {t(`agents.type.${r.type}` as MessageId)}
                </span>
              )
            },
            {
              key: "createdAt",
              header: t("agents.col.created"),
              width: 140,
              render: (r) => (
                <span className="text-fg-muted">{formatRelativeDate(r.createdAt, language)}</span>
              )
            },
            {
              key: "id",
              header: "",
              align: "right",
              width: 56,
              render: (r) => (
                <RowActionsMenu
                  items={[
                    {
                      label: t("agents.actions.view"),
                      onClick: () => navigate(`/agent-templates/${r.id}`)
                    },
                    {
                      label: t("agents.actions.edit"),
                      onClick: () => setEditing(r)
                    },
                    r.archivedAt
                      ? {
                          label: t("agents.actions.restore"),
                          onClick: () => setArchived.mutate({ id: r.id, archived: false })
                        }
                      : {
                          label: t("agents.actions.archive"),
                          onClick: () => setArchiving(r)
                        }
                  ]}
                />
              )
            }
          ]}
        />
      )}

      <VariablesHint />

      {showCreate && (
        <ChannelPickerDialog
          onClose={() => setShowCreate(false)}
          onPick={(type) => {
            setShowCreate(false);
            setCreateType(type);
          }}
        />
      )}

      {createType && (
        <CreateAgentTemplateModal
          type={createType}
          onClose={() => setCreateType(null)}
          onSuccess={() => {
            setCreateType(null);
            invalidate();
          }}
        />
      )}

      {editing && (
        <EditAgentTemplateModal
          template={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => setEditing(null)}
        />
      )}

      {archiving && (
        <ArchiveAgentDialog
          template={archiving}
          isPending={setArchived.isPending}
          onClose={() => setArchiving(null)}
          onConfirm={() => setArchived.mutate({ id: archiving.id, archived: true })}
        />
      )}
    </div>
  );
}

/**
 * Confirms archiving an agent. Names the campaigns that still run it (active or paused):
 * archiving doesn't stop them, it only hides the agent from the list and new campaigns.
 */
function ArchiveAgentDialog({
  template,
  isPending,
  onClose,
  onConfirm
}: {
  template: Template;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const query = trpc.agentTemplates.get.useQuery({ id: template.id });
  const campaigns = (
    (query.data as { campaigns?: { id: string; name: string; status: string }[] } | undefined)
      ?.campaigns ?? []
  ).filter((c) => c.status === "ACTIVE" || c.status === "PAUSED");

  return (
    <Dialog
      open
      onClose={onClose}
      width={520}
      title={t("agents.archive.title")}
      confirmLabel={t("agents.archive.title")}
      confirmVariant="destructive"
      confirmIcon={<Archive className="h-4 w-4" />}
      confirmDisabled={isPending}
      onConfirm={onConfirm}
    >
      <p className="text-sm text-fg-muted">
        {t("agents.archive.body").replace("{name}", template.name)}
      </p>
      {campaigns.length > 0 && (
        <Alert
          variant="warning"
          title={
            campaigns.length === 1
              ? t("agents.archive.usedByOne")
              : t("agents.archive.usedByMany").replace("{count}", String(campaigns.length))
          }
          description={t(
            campaigns.length === 1 ? "agents.archive.usedByBodyOne" : "agents.archive.usedByBody"
          ).replace("{names}", campaigns.map((c) => c.name).join(", "))}
        />
      )}
    </Dialog>
  );
}

/** Picker order, per the design: the two voice channels, then the text ones. */
const CREATABLE_TYPES: AgentType[] = ["VOICE_AI", "VOICE_PRERECORDED", "SMS", "WHATSAPP", "EMAIL"];

/** First step of "Nuevo agente": pick the channel (it can't change later). */
function ChannelPickerDialog({
  onClose,
  onPick
}: {
  onClose: () => void;
  onPick: (type: AgentType) => void;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<AgentType>("VOICE_AI");
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("agents.channelPicker.title")}
      subtitle={t("agents.channelPicker.subtitle")}
      confirmLabel={t("agents.channelPicker.continue")}
      onSubmit={() => onPick(type)}
    >
      <ChoiceCardGroup
        name="agent-channel"
        vertical
        value={type}
        onChange={setType}
        options={CREATABLE_TYPES.map((tp) => ({
          value: tp,
          title: t(`agents.type.${tp}` as MessageId),
          description: t(`agents.channel.${tp}` as MessageId),
          icon: TYPE_ICON[tp]
        }))}
      />
    </Dialog>
  );
}

/**
 * The agent create/edit container by channel (the overlay rule): the voice forms are long
 * and sectioned, so they open in a single-column drawer; SMS, WhatsApp and Correo fit a
 * dialog.
 */
function AgentFormOverlay({ type, ...props }: OverlayChromeProps & { type: AgentType }) {
  if (type === "VOICE_AI" || type === "VOICE_PRERECORDED") {
    return <Drawer width={600} {...props} />;
  }
  return <Dialog width={type === "SMS" ? 560 : 620} {...props} />;
}

/** Voice template languages. `multi` (callers mixing languages) only means something for
 *  VOICE_AI, whose speech recognition runs on it; a pre-recorded call recognizes no speech. */
function languagesFor(type: AgentType): string[] {
  const base = [DEFAULT_VOICE_LANGUAGE, "en"];
  return type === "VOICE_AI" ? [...base, MULTILINGUAL_LANGUAGE] : base;
}

type DtmfFieldErrors = Partial<
  Record<
    "repeatDigit" | "repeatMessage" | "optOutDigit" | "optOutMessage" | "optOutConfirmationMessage",
    string
  >
>;

/**
 * Client-side validation for the key menu, inline so an operator sees the problem before
 * submitting rather than only via the server's rejection. Delegates the actual rules (message
 * required exactly when its key is set, the two keys must differ, a key is a single
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

type IdleFieldErrors = Partial<
  Record<"idleMessage" | "idleTimeout" | "idleMaxTimeoutCount", string>
>;

/**
 * VOICE_AI idle options must be a non-empty message, a timeout of at least 3000 ms, and a
 * max-timeout count of at least 1 — mirrors the `createAgentTemplateSchema` bounds so an
 * invalid submit is caught before the request, under the field at fault. The fields are
 * pre-filled from the deployment default, so this only fails if the operator clears or
 * lowers a value.
 */
function validateIdleConfig(
  fields: Record<string, string>,
  t: (id: MessageId) => string
): IdleFieldErrors {
  const errors: IdleFieldErrors = {};
  const timeout = Number(fields.idleTimeout);
  const maxCount = Number(fields.idleMaxTimeoutCount);
  if ((fields.idleMessage ?? "").trim().length === 0) {
    errors.idleMessage = t("agents.form.idleMessageRequired");
  }
  if (!fields.idleTimeout || !Number.isInteger(timeout) || timeout < 3000) {
    errors.idleTimeout = t("agents.form.idleTimeoutMin");
  }
  if (!fields.idleMaxTimeoutCount || !Number.isInteger(maxCount) || maxCount < 1) {
    errors.idleMaxTimeoutCount = t("agents.form.idleMaxMin");
  }
  return errors;
}

/** Everything a submit is checked against, by field. Empty when the form is valid. */
function validateAgentForm(
  type: AgentType,
  name: string,
  fields: Record<string, string>,
  t: (id: MessageId) => string
): Record<string, string> {
  return {
    ...(name.trim() ? {} : { name: t("agents.form.nameRequired") }),
    ...(type === "VOICE_AI" ? validateIdleConfig(fields, t) : {}),
    ...(type === "VOICE_PRERECORDED" ? validateVoicePrerecordedDtmf(fields, t) : {})
  };
}

/** The boolean settings, which don't ride along in the string-valued `fields` bag. */
type AgentFlags = {
  normalizeGsm7: boolean;
  hangupOnMachineDetected: boolean;
  allowUserBargeIn: boolean;
};

/**
 * The per-channel form body, shared by the create and edit overlays so they can't drift.
 * `channelSlot` renders after the name (the locked channel field, in edit).
 */
function AgentFormFields({
  type,
  idPrefix,
  name,
  onNameChange,
  fields,
  set,
  flags,
  setFlag,
  errors,
  channelSlot
}: {
  type: AgentType;
  idPrefix: string;
  name: string;
  onNameChange: (value: string) => void;
  fields: Record<string, string>;
  set: (key: string, value: string) => void;
  flags: AgentFlags;
  setFlag: (key: keyof AgentFlags, value: boolean) => void;
  errors: Record<string, string>;
  channelSlot?: React.ReactNode;
}) {
  const { t } = useI18n();
  const { data: voices } = trpc.config.voices.useQuery(undefined, {
    enabled: type === "VOICE_AI" || type === "VOICE_PRERECORDED"
  });
  const id = (key: string) => `${idPrefix}-${key}`;
  const isVoice = type === "VOICE_AI" || type === "VOICE_PRERECORDED";

  const text = (
    key: keyof typeof FIELD_PLACEHOLDER | "maxReplies",
    label: MessageId,
    extra: Partial<React.ComponentProps<typeof InputGroup>> = {}
  ) => (
    <InputGroup
      label={t(label)}
      id={id(key)}
      placeholder={key === "maxReplies" ? String(DEFAULT_MAX_REPLIES) : t(FIELD_PLACEHOLDER[key])}
      value={fields[key] ?? ""}
      onChange={(e) => set(key, e.target.value)}
      error={errors[key]}
      {...extra}
    />
  );
  const longText = (key: keyof typeof FIELD_PLACEHOLDER, label: MessageId, rows: number) => (
    <TextareaGroup
      label={t(label)}
      id={id(key)}
      rows={rows}
      placeholder={t(FIELD_PLACEHOLDER[key])}
      value={fields[key] ?? ""}
      onChange={(e) => set(key, e.target.value)}
      error={errors[key]}
    />
  );
  const prompt = (rows: number, mono = false) => (
    <TextareaGroup
      label={t("agents.form.systemPrompt")}
      id={id("prompt")}
      rows={rows}
      className={mono ? "[&_textarea]:font-mono [&_textarea]:text-xs" : undefined}
      placeholder={t(FIELD_PLACEHOLDER.systemPrompt)}
      value={fields.systemPrompt ?? ""}
      onChange={(e) => set("systemPrompt", e.target.value)}
    />
  );
  const maxReplies = (
    <div className="w-[280px]">
      {text("maxReplies", "agents.form.maxReplies", { type: "number", min: 1 })}
    </div>
  );

  return (
    <>
      <InputGroup
        label={t("agents.form.name")}
        id={id("name")}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        error={errors.name}
      />
      {channelSlot}

      {isVoice && (
        <div className="grid grid-cols-2 gap-3">
          <SelectGroup
            label={t("agents.form.language")}
            id={id("lang")}
            value={fields.language ?? DEFAULT_VOICE_LANGUAGE}
            onChange={(e) => set("language", e.target.value)}
          >
            {languagesFor(type).map((lng) => (
              <option key={lng} value={lng}>
                {t(`agents.lang.${lng}` as MessageId)}
              </option>
            ))}
          </SelectGroup>
          <SelectGroup
            label={t("agents.form.voice")}
            id={id("voice")}
            value={fields.voice ?? ""}
            onChange={(e) => set("voice", e.target.value)}
          >
            <option value="" disabled>
              {t("agents.form.voicePlaceholder")}
            </option>
            {(voices ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {`${v.name} (${v.language}, ${t(`agents.gender.${v.gender}` as MessageId)})`}
              </option>
            ))}
          </SelectGroup>
        </div>
      )}

      {type === "VOICE_AI" && (
        <>
          {text("firstMessage", "agents.form.firstMessage")}
          {text("idleMessage", "agents.form.idleMessage")}
          <div className="grid grid-cols-2 items-start gap-3">
            {text("idleTimeout", "agents.form.idleTimeout", {
              type: "number",
              min: 3000,
              className: "[&_input]:font-mono"
            })}
            {text("idleMaxTimeoutCount", "agents.form.idleMaxTimeoutCount", {
              type: "number",
              min: 1,
              className: "[&_input]:font-mono"
            })}
          </div>
          <Switch
            id={id("barge-in")}
            label={t("agents.form.allowUserBargeIn")}
            checked={flags.allowUserBargeIn}
            onChange={(e) => setFlag("allowUserBargeIn", e.target.checked)}
          />
          {prompt(10, true)}
        </>
      )}

      {type === "VOICE_PRERECORDED" && (
        <>
          {longText("script", "agents.form.script", 5)}
          <Checkbox
            id={id("hangup-on-amd")}
            label={t("agents.form.hangupOnMachineDetected")}
            description={t("agents.form.hangupOnMachineDetectedDescription")}
            checked={flags.hangupOnMachineDetected}
            onChange={(e) => setFlag("hangupOnMachineDetected", e.target.checked)}
          />
          <section className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-fg">{t("agents.form.dtmfSectionTitle")}</h3>
              <p className="text-xs text-fg-muted">{t("agents.form.dtmfSectionDescription")}</p>
            </div>
            <div className="grid grid-cols-2 items-start gap-3">
              {text("repeatDigit", "agents.form.repeatDigit", {
                maxLength: 1,
                className: "[&_input]:font-mono"
              })}
              {text("maxRepeats", "agents.form.maxRepeats", {
                type: "number",
                min: 1,
                className: "[&_input]:font-mono"
              })}
            </div>
            {text("repeatMessage", "agents.form.repeatMessage")}
            {text("optOutDigit", "agents.form.optOutDigit", {
              maxLength: 1,
              className: "[&_input]:font-mono"
            })}
            {text("optOutMessage", "agents.form.optOutMessage")}
            {text("optOutConfirmationMessage", "agents.form.optOutConfirmationMessage")}
          </section>
        </>
      )}

      {type === "SMS" && (
        <SmsFields
          idPrefix={idPrefix}
          messageBody={fields.messageBody ?? ""}
          senderId={fields.senderId ?? ""}
          normalizeGsm7={flags.normalizeGsm7}
          onChange={set}
          onNormalizeChange={(v) => setFlag("normalizeGsm7", v)}
        />
      )}

      {type === "EMAIL" && (
        <>
          {text("subject", "agents.form.subject")}
          {longText("messageBody", "agents.form.messageBody", 4)}
          {prompt(4)}
          {maxReplies}
        </>
      )}

      {type === "WHATSAPP" && (
        <>
          <WhatsAppTemplateFields idPrefix={idPrefix} fields={fields} set={set} />
          {prompt(4)}
          {maxReplies}
        </>
      )}
    </>
  );
}

/**
 * WhatsApp's template name and its read-only preview, fetched from Meta as the operator
 * types (debounced). The fetched body is what's saved as the agent's `messageBody`.
 */
function WhatsAppTemplateFields({
  idPrefix,
  fields,
  set
}: {
  idPrefix: string;
  fields: Record<string, string>;
  set: (key: string, value: string) => void;
}) {
  const { t } = useI18n();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedName, setDebouncedName] = useState("");

  const integration = trpc.whatsAppIntegration.get.useQuery();
  const preview = trpc.whatsAppIntegration.previewTemplate.useQuery(
    { templateName: debouncedName },
    { enabled: debouncedName.length > 0 }
  );

  // Clear the stale body immediately when the target name changes, so a lingering success
  // from the previous name is never mistaken for the new one's — before this, changing the
  // template name after a successful lookup silently kept showing (and would have saved) the
  // old template's body until/unless the new lookup also succeeded. Guarded on non-empty so
  // it doesn't fire on mount and mask the "enter a name" empty-state hint below.
  useEffect(() => {
    if (!debouncedName) return;
    set("messageBody", "");
  }, [debouncedName]);

  useEffect(() => {
    if (preview.data) set("messageBody", preview.data.body ?? "");
  }, [preview.data]);

  const previewText = preview.isFetching
    ? t("agents.form.templatePreviewLoading")
    : fields.messageBody || (debouncedName ? "" : t("agents.form.templatePreviewEmpty"));

  return (
    <>
      {!integration.data?.connected && !integration.isLoading && (
        <Alert variant="warning" description={t("agents.form.noIntegrationWarning")} />
      )}
      <InputGroup
        label={t("agents.form.templateName")}
        id={`${idPrefix}-wa-tname`}
        className="[&_input]:font-mono"
        placeholder={t(FIELD_PLACEHOLDER.templateName)}
        value={fields.templateName ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          set("templateName", value);
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(() => setDebouncedName(value.trim()), 600);
        }}
      />
      <Field label={t("agents.form.templatePreview")}>
        <div
          aria-live="polite"
          className="min-h-10 whitespace-pre-wrap rounded-control bg-elevated px-3 py-2.5 text-sm text-fg-muted"
        >
          {previewText}
        </div>
        {preview.isError && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-danger">{t("agents.form.templatePreviewError")}</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => preview.refetch()}>
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
      </Field>
    </>
  );
}

/** Puts the first field error in view after a refused submit (long drawers scroll). */
function focusFirstError(idPrefix: string, errors: Record<string, string>) {
  const first = Object.keys(errors)[0];
  if (!first) return;
  const el = document.getElementById(`${idPrefix}-${first}`);
  el?.focus();
}

function CreateAgentTemplateModal({
  type,
  onClose,
  onSuccess
}: {
  type: AgentType;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  // hangupOnMachineDetected defaults on and barge-in off, mirroring the server defaults.
  const [flags, setFlags] = useState<AgentFlags>({
    normalizeGsm7: false,
    hangupOnMachineDetected: true,
    allowUserBargeIn: false
  });
  const [fields, setFields] = useState<Record<string, string>>({
    // `multi` is VOICE_AI-only, so every type starts on the default language.
    language: DEFAULT_VOICE_LANGUAGE,
    // Idle options pre-filled from the deployment default; the operator may override.
    idleMessage: DEFAULT_VOICE_IDLE_OPTIONS.message,
    idleTimeout: String(DEFAULT_VOICE_IDLE_OPTIONS.timeout),
    idleMaxTimeoutCount: String(DEFAULT_VOICE_IDLE_OPTIONS.maxTimeoutCount)
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allErrors = validateAgentForm(type, name, fields, t);
  // Key-menu errors show as soon as the menu is inconsistent; the rest after a submit.
  const errors = submitted
    ? allErrors
    : type === "VOICE_PRERECORDED"
      ? validateVoicePrerecordedDtmf(fields, t)
      : {};

  const create = trpc.agentTemplates.create.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function set(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function handleCreate() {
    setSubmitted(true);
    if (Object.keys(allErrors).length > 0) {
      focusFirstError("a", allErrors);
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
          language: fields.language ?? DEFAULT_VOICE_LANGUAGE,
          idleMessage: fields.idleMessage ?? "",
          idleTimeout: Number(fields.idleTimeout),
          idleMaxTimeoutCount: Number(fields.idleMaxTimeoutCount),
          allowUserBargeIn: flags.allowUserBargeIn
        };
        break;
      case "VOICE_PRERECORDED":
        payload = {
          ...base,
          type,
          voice: fields.voice ?? "",
          script: fields.script ?? "",
          language: fields.language ?? DEFAULT_VOICE_LANGUAGE,
          ...(fields.repeatDigit ? { repeatDigit: fields.repeatDigit } : {}),
          ...(fields.repeatMessage ? { repeatMessage: fields.repeatMessage } : {}),
          ...(fields.maxRepeats ? { maxRepeats: Number(fields.maxRepeats) } : {}),
          ...(fields.optOutDigit ? { optOutDigit: fields.optOutDigit } : {}),
          ...(fields.optOutMessage ? { optOutMessage: fields.optOutMessage } : {}),
          ...(fields.optOutConfirmationMessage
            ? { optOutConfirmationMessage: fields.optOutConfirmationMessage }
            : {}),
          hangupOnMachineDetected: flags.hangupOnMachineDetected
        };
        break;
      case "SMS":
        payload = {
          ...base,
          type,
          messageBody: fields.messageBody ?? "",
          ...(fields.senderId ? { senderId: fields.senderId } : {}),
          ...(flags.normalizeGsm7 ? { normalizeGsm7: true } : {})
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

  return (
    <AgentFormOverlay
      type={type}
      open
      onClose={onClose}
      title={`${t("agents.new")} · ${t(`agents.type.${type}` as MessageId)}`}
      subtitle={t(`agents.create.subtitle.${type}` as MessageId)}
      confirmLabel={create.isPending ? t("common.creating") : t("agents.form.create")}
      confirmDisabled={create.isPending}
      onSubmit={handleCreate}
      error={error}
    >
      <AgentFormFields
        type={type}
        idPrefix="a"
        name={name}
        onNameChange={setName}
        fields={fields}
        set={set}
        flags={flags}
        setFlag={(k, v) => setFlags((f) => ({ ...f, [k]: v }))}
        errors={errors}
      />
    </AgentFormOverlay>
  );
}

type FullTemplate = {
  id: string;
  name: string;
  type: AgentType;
  voiceAiConfig: (Record<string, unknown> & { allowUserBargeIn?: boolean }) | null;
  voicePrerecordedConfig: (Record<string, unknown> & { hangupOnMachineDetected?: boolean }) | null;
  smsConfig: (Record<string, unknown> & { normalizeGsm7?: boolean }) | null;
  emailConfig: Record<string, unknown> | null;
  whatsAppConfig: Record<string, unknown> | null;
};

/** "Editar agente": the same per-channel form, with the channel shown as a locked field. */
export function EditAgentTemplateModal({
  template,
  onClose,
  onSuccess
}: {
  template: EditableTemplate;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const query = trpc.agentTemplates.get.useQuery({ id: template.id });
  const full = query.data as FullTemplate | undefined;

  const [name, setName] = useState(template.name);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<AgentFlags>({
    normalizeGsm7: false,
    hangupOnMachineDetected: true,
    allowUserBargeIn: false
  });
  const [seeded, setSeeded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allErrors = validateAgentForm(template.type, name, fields, t);
  const errors = submitted
    ? allErrors
    : template.type === "VOICE_PRERECORDED"
      ? validateVoicePrerecordedDtmf(fields, t)
      : {};

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
    setFlags({
      normalizeGsm7: full.smsConfig?.normalizeGsm7 ?? false,
      hangupOnMachineDetected: full.voicePrerecordedConfig?.hangupOnMachineDetected ?? true,
      allowUserBargeIn: full.voiceAiConfig?.allowUserBargeIn ?? false
    });
    setSeeded(true);
  }, [full, seeded]);

  const update = trpc.agentTemplates.update.useMutation({
    onSuccess: () => {
      utils.agentTemplates.list.invalidate();
      // Without this, reopening Editar right after a save can show the pre-save values:
      // `get` is keyed by this template's id and nothing else invalidates it, so the cached
      // response from the last time this overlay was open wins the race against a fresh
      // fetch until it separately goes stale on its own.
      utils.agentTemplates.get.invalidate({ id: template.id });
      onSuccess();
    },
    onError: (err) => setError(err.message)
  });

  function set(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    setSubmitted(true);
    if (Object.keys(allErrors).length > 0) {
      focusFirstError("e", allErrors);
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
          idleMaxTimeoutCount: Number(fields.idleMaxTimeoutCount),
          allowUserBargeIn: flags.allowUserBargeIn
        };
        break;
      case "VOICE_PRERECORDED":
        config = {
          voice: fields.voice,
          script: fields.script,
          language: fields.language,
          // Sent explicitly (including null) rather than omitted-when-falsy: `fields` is
          // always fully seeded from the current config on load, so this is the one place
          // an operator can actually clear a previously-set key/message and disable the
          // menu — omitting empty values here would silently keep the old ones in the DB.
          repeatDigit: fields.repeatDigit || null,
          repeatMessage: fields.repeatMessage || null,
          maxRepeats: fields.maxRepeats ? Number(fields.maxRepeats) : null,
          optOutDigit: fields.optOutDigit || null,
          optOutMessage: fields.optOutMessage || null,
          optOutConfirmationMessage: fields.optOutConfirmationMessage || null,
          hangupOnMachineDetected: flags.hangupOnMachineDetected
        };
        break;
      case "SMS":
        config = {
          messageBody: fields.messageBody,
          ...(fields.senderId ? { senderId: fields.senderId } : {}),
          // Always sent, not omitted-when-false, so an operator can actually turn it off.
          normalizeGsm7: flags.normalizeGsm7
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

  const isLoading = !seeded && query.isLoading;

  return (
    <AgentFormOverlay
      type={template.type}
      open
      onClose={onClose}
      title={t("agents.form.editTitle")}
      subtitle={t("agents.form.editSubtitle")}
      confirmLabel={update.isPending ? t("common.saving") : t("agents.form.save")}
      confirmDisabled={update.isPending}
      onSubmit={handleSave}
      error={error}
    >
      {isLoading ? (
        <p className="text-sm text-fg-subtle">…</p>
      ) : (
        <AgentFormFields
          type={template.type}
          idPrefix="e"
          name={name}
          onNameChange={setName}
          fields={fields}
          set={set}
          flags={flags}
          setFlag={(k, v) => setFlags((f) => ({ ...f, [k]: v }))}
          errors={errors}
          channelSlot={
            <Field label={t("agents.form.channelLocked")}>
              <div className="flex h-10 items-center gap-2.5 rounded-control border border-input bg-bg px-3 text-sm text-fg-muted">
                <Lock aria-hidden className="h-3.5 w-3.5" />
                {t(`agents.type.${template.type}` as MessageId)}
              </div>
            </Field>
          }
        />
      )}
    </AgentFormOverlay>
  );
}
