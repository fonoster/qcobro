import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Bot, Info, Pencil, RefreshCw } from "lucide-react";
import { calculateSmsSegments, normalizeForGsm7 } from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useI18n, type MessageId } from "../lib/i18n.js";
import { formatRelativeDate } from "../lib/relativeDate.js";
import { SAMPLE_ACCOUNT } from "../lib/sampleAccount.js";
import { useWorkspaceCurrency } from "../lib/useWorkspaceCurrency.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { DetailHeader } from "../components/detail-header.js";
import { Breadcrumb } from "../components/ui/breadcrumb.js";
import { Tabs } from "../components/ui/tabs.js";
import { InputGroup } from "../components/ui/input.js";
import { Panel } from "../components/panel.js";
import { EditAgentTemplateModal, TYPE_ICON, type AgentType } from "./AgentTemplates.js";

type Config = Record<string, string | number | boolean | null>;

type FullTemplate = {
  id: string;
  name: string;
  type: AgentType;
  updatedAt: Date | string;
  voiceAiConfig: Config | null;
  voicePrerecordedConfig: Config | null;
  smsConfig: Config | null;
  emailConfig: Config | null;
  whatsAppConfig: Config | null;
  campaigns: { id: string; name: string; status: string }[];
};

/** A key/value row: muted key on the left, the value on the right. Hidden when empty. */
function KeyValue({ label, value }: { label: string; value?: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-6 text-[13px]">
      <span className="shrink-0 text-fg-muted">{label}</span>
      <span className="min-w-0 text-right text-fg">{value}</span>
    </div>
  );
}

/** A long text (prompt, script, body) in a muted box. */
function TextBlock({ children, mono }: { children: string; mono?: boolean }) {
  return (
    <div
      className={
        "whitespace-pre-wrap break-words rounded-control bg-elevated px-4 py-3.5 text-fg " +
        (mono ? "font-mono text-xs leading-relaxed" : "text-[13px] leading-normal")
      }
    >
      {children}
    </div>
  );
}

export function AgentTemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState("config");
  const [editing, setEditing] = useState(false);

  const query = trpc.agentTemplates.get.useQuery({ id: id! });
  const tmpl = query.data as FullTemplate | undefined;

  const { data: voices } = trpc.config.voices.useQuery();
  const [syncError, setSyncError] = useState(false);
  const sync = trpc.agentTemplates.sync.useMutation({
    onMutate: () => setSyncError(false),
    onSuccess: () => query.refetch(),
    onError: () => setSyncError(true)
  });

  const voiceCfg = tmpl?.voiceAiConfig ?? tmpl?.voicePrerecordedConfig ?? null;
  const synced = voiceCfg?.fonosterAppRef != null;
  // Only VOICE_AI agents sync to Fonoster (as AUTOPILOT apps). Pre-recorded and the
  // text channels are managed locally and have no per-agent sync.
  const syncsWithFonoster = tmpl?.type === "VOICE_AI";
  // A render-only preview exists for the channels whose message is fixed text.
  const hasPreview = tmpl?.type === "SMS" || tmpl?.type === "VOICE_PRERECORDED";

  const yesNo = (value: unknown) =>
    typeof value === "boolean" ? t(value ? "agents.detail.yes" : "agents.detail.no") : null;
  const str = (value: unknown) => (value === null || value === undefined ? null : String(value));
  const mono = (value: unknown, suffix = "") =>
    value === null || value === undefined || value === "" ? null : (
      <span className="font-mono">{`${String(value)}${suffix}`}</span>
    );

  // Resolve the stored voice id to its catalog label (name, language, gender).
  const voiceEntry = voices?.find((v) => v.id === voiceCfg?.voice);
  // A voice outside the catalog reads as "Voz personalizada", never as its raw id.
  const voiceLabel = voiceEntry
    ? `${voiceEntry.name} (${voiceEntry.language}, ${t(`agents.gender.${voiceEntry.gender}` as MessageId)})`
    : voiceCfg?.voice && voices
      ? t("agents.voice.custom")
      : null;
  // Map the stored language code (e.g. "es-419") to its human-friendly label.
  const languageLabel = voiceCfg?.language
    ? (t(`agents.lang.${voiceCfg.language}` as MessageId) ?? String(voiceCfg.language))
    : null;

  const syncLabel = syncError
    ? t("agents.sync.error")
    : synced
      ? t("agents.sync.synced")
      : t("agents.sync.pending");

  const updated = tmpl
    ? t("agents.detail.updated").replace(
        "{when}",
        formatRelativeDate(tmpl.updatedAt, language).toLocaleLowerCase(language)
      )
    : "";

  /** The channel's settings as key/value rows, and its long texts as their own panels. */
  function configBody(tp: FullTemplate) {
    const rows: ReactNode[] = [];
    const texts: { title: string; text: string; mono?: boolean }[] = [];
    let panelTitle = t("agents.detail.message");
    if (tp.voiceAiConfig) {
      const c = tp.voiceAiConfig;
      panelTitle = t("agents.detail.conversation");
      rows.push(
        <KeyValue key="lang" label={t("agents.form.language")} value={languageLabel} />,
        <KeyValue key="voice" label={t("agents.form.voice")} value={voiceLabel} />,
        <KeyValue key="first" label={t("agents.form.firstMessage")} value={str(c.firstMessage)} />,
        <KeyValue
          key="barge"
          label={t("agents.detail.allowUserBargeIn")}
          value={yesNo(c.allowUserBargeIn)}
        />,
        <KeyValue key="idle" label={t("agents.form.idleMessage")} value={str(c.idleMessage)} />,
        <KeyValue
          key="idle-timeout"
          label={t("agents.detail.idleTimeout")}
          value={mono(c.idleTimeout, " ms")}
        />,
        <KeyValue
          key="idle-max"
          label={t("agents.form.idleMaxTimeoutCount")}
          value={mono(c.idleMaxTimeoutCount)}
        />
      );
      if (c.systemPrompt)
        texts.push({
          title: t("agents.form.systemPrompt"),
          text: String(c.systemPrompt),
          mono: true
        });
    }
    if (tp.voicePrerecordedConfig) {
      const c = tp.voicePrerecordedConfig;
      rows.push(
        <KeyValue key="lang" label={t("agents.form.language")} value={languageLabel} />,
        <KeyValue key="voice" label={t("agents.form.voice")} value={voiceLabel} />,
        <KeyValue
          key="amd"
          label={t("agents.form.hangupOnMachineDetected")}
          value={yesNo(c.hangupOnMachineDetected)}
        />,
        <KeyValue key="rd" label={t("agents.form.repeatDigit")} value={mono(c.repeatDigit)} />,
        <KeyValue key="rm" label={t("agents.form.repeatMessage")} value={str(c.repeatMessage)} />,
        <KeyValue key="mr" label={t("agents.form.maxRepeats")} value={mono(c.maxRepeats)} />,
        <KeyValue key="od" label={t("agents.form.optOutDigit")} value={mono(c.optOutDigit)} />,
        <KeyValue key="om" label={t("agents.form.optOutMessage")} value={str(c.optOutMessage)} />,
        <KeyValue
          key="oc"
          label={t("agents.form.optOutConfirmationMessage")}
          value={str(c.optOutConfirmationMessage)}
        />
      );
      if (c.script) texts.push({ title: t("agents.form.script"), text: String(c.script) });
    }
    if (tp.smsConfig) {
      const c = tp.smsConfig;
      rows.push(
        <KeyValue key="sender" label={t("agents.form.senderId")} value={str(c.senderId)} />,
        <KeyValue
          key="gsm7"
          label={t("agents.form.normalizeGsm7")}
          value={yesNo(c.normalizeGsm7)}
        />
      );
      if (c.messageBody)
        texts.push({ title: t("agents.form.messageBody"), text: String(c.messageBody) });
    }
    if (tp.emailConfig) {
      const c = tp.emailConfig;
      rows.push(
        <KeyValue key="subject" label={t("agents.form.subject")} value={str(c.subject)} />,
        <KeyValue key="replies" label={t("agents.form.maxReplies")} value={mono(c.maxReplies)} />
      );
      if (c.messageBody)
        texts.push({ title: t("agents.form.messageBody"), text: String(c.messageBody) });
      if (c.systemPrompt)
        texts.push({
          title: t("agents.form.systemPrompt"),
          text: String(c.systemPrompt),
          mono: true
        });
    }
    if (tp.whatsAppConfig) {
      const c = tp.whatsAppConfig;
      rows.push(
        <KeyValue key="tname" label={t("agents.form.templateName")} value={mono(c.templateName)} />,
        <KeyValue key="replies" label={t("agents.form.maxReplies")} value={mono(c.maxReplies)} />
      );
      if (c.messageBody)
        texts.push({ title: t("agents.form.messageBody"), text: String(c.messageBody) });
      if (c.systemPrompt)
        texts.push({
          title: t("agents.form.systemPrompt"),
          text: String(c.systemPrompt),
          mono: true
        });
    }

    return (
      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <Panel title={panelTitle}>
            <div className="flex flex-col gap-3">{rows}</div>
          </Panel>
          {texts.map((x, i) => (
            <Panel key={x.title} title={x.title} aside={i === 0 ? updated : undefined}>
              <TextBlock mono={x.mono}>{x.text}</TextBlock>
            </Panel>
          ))}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[360px]">
          <Panel title={t("agents.detail.campaigns")} aside={String(tp.campaigns.length)}>
            {tp.campaigns.length > 0 ? (
              <ul className="flex flex-col">
                {tp.campaigns.map((c, i) => (
                  <li key={c.id} className={i > 0 ? "border-t border-border" : undefined}>
                    <button
                      type="button"
                      onClick={() => navigate(`/campaigns/${c.id}`)}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 py-2.5 text-left text-[13px] text-fg hover:text-fg-muted"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0">
                        {t(`campaigns.status.${c.status}` as MessageId)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-fg-muted">{t("agents.detail.noCampaigns")}</p>
            )}
          </Panel>
          {syncsWithFonoster && (
            <Panel title={t("agents.detail.syncPanel")}>
              <KeyValue label={t("agents.detail.syncState")} value={syncLabel} />
            </Panel>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb
        items={[
          { label: t("agents.title"), href: "/agent-templates" },
          { label: tmpl?.name ?? "…" }
        ]}
      />

      <DetailHeader
        icon={(tmpl && TYPE_ICON[tmpl.type]) ?? <Bot />}
        title={tmpl?.name ?? "…"}
        badge={
          syncsWithFonoster && tmpl ? (
            <Badge variant={syncError ? "destructive" : "secondary"}>{syncLabel}</Badge>
          ) : undefined
        }
        meta={
          tmpl
            ? [t(`agents.type.${tmpl.type}` as MessageId), languageLabel, voiceLabel]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        actions={
          tmpl ? (
            <>
              {syncsWithFonoster && (
                <Button
                  variant="ghost"
                  disabled={sync.isPending}
                  onClick={() => sync.mutate({ id: tmpl.id })}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("agents.sync.action")}
                </Button>
              )}
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                {t("agents.actions.edit")}
              </Button>
            </>
          ) : undefined
        }
      />

      {tmpl && (
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: "config", label: t("agents.detail.config"), content: configBody(tmpl) },
            ...(hasPreview
              ? [
                  {
                    id: "preview",
                    label: t("agents.tab.preview"),
                    content: <PreviewTab template={tmpl} />
                  }
                ]
              : [])
          ]}
        />
      )}

      {editing && tmpl && (
        <EditAgentTemplateModal
          template={tmpl}
          onClose={() => setEditing(false)}
          onSuccess={() => setEditing(false)}
        />
      )}
    </div>
  );
}

type SampleAccount = { fullName: string; outstandingBalance: string; daysPastDue: string };

/**
 * "Vista previa" for the fixed-text channels (SMS, pre-recorded voice): renders the stored
 * message against an editable sample account through `agentTemplates.preview`. Sends nothing.
 */
function PreviewTab({ template }: { template: FullTemplate }) {
  const { t } = useI18n();
  const currency = useWorkspaceCurrency();
  const [draft, setDraft] = useState<SampleAccount>({
    fullName: SAMPLE_ACCOUNT.fullName,
    outstandingBalance: String(SAMPLE_ACCOUNT.outstandingBalance),
    daysPastDue: String(SAMPLE_ACCOUNT.daysPastDue)
  });
  const [account, setAccount] = useState<SampleAccount>(draft);

  const preview = trpc.agentTemplates.preview.useQuery(
    {
      agentTemplateId: template.id,
      account: {
        fullName: account.fullName.trim() || SAMPLE_ACCOUNT.fullName,
        outstandingBalance: Number(account.outstandingBalance) || 0,
        daysPastDue: Math.trunc(Number(account.daysPastDue)) || 0,
        currency
      }
    },
    { retry: false }
  );

  const rendered = preview.data?.rendered ?? "";
  const normalize = template.smsConfig?.normalizeGsm7 === true;
  const seg =
    template.type === "SMS" && rendered
      ? calculateSmsSegments(normalize ? normalizeForGsm7(rendered) : rendered)
      : null;
  const segLabel = seg
    ? t(seg.segmentCount === 1 ? "agents.form.smsSegmentOne" : "agents.form.smsSegments")
        .replace("{segments}", String(seg.segmentCount))
        .replace("{characters}", String(seg.characterCount))
    : undefined;

  function generate(e: FormEvent) {
    e.preventDefault();
    if (JSON.stringify(draft) === JSON.stringify(account)) preview.refetch();
    else setAccount(draft);
  }

  const field = (key: keyof SampleAccount, label: string, numeric = false) => (
    <InputGroup
      id={`preview-${key}`}
      label={label}
      type={numeric ? "number" : "text"}
      className={numeric ? "[&_input]:font-mono" : undefined}
      value={draft[key]}
      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
    />
  );

  return (
    <div className="flex flex-col items-start gap-4 lg:flex-row">
      <form onSubmit={generate} className="w-full shrink-0 lg:w-[440px]">
        <Panel title={t("agents.preview.account")}>
          {field("fullName", t("agents.preview.name"))}
          <div className="grid grid-cols-2 gap-3">
            {field(
              "outstandingBalance",
              t("agents.preview.balance").replace("{currency}", currency),
              true
            )}
            {field("daysPastDue", t("agents.preview.daysPastDue"), true)}
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" disabled={preview.isFetching}>
              <RefreshCw className="h-4 w-4" />
              {t("agents.preview.generate")}
            </Button>
          </div>
        </Panel>
      </form>
      <div className="w-full min-w-0 flex-1">
        <Panel
          title={t("agents.preview.rendered")}
          aside={segLabel && <span className="font-mono text-xs text-fg-muted">{segLabel}</span>}
        >
          <div className="rounded-xl bg-bg p-5">
            <div
              aria-live="polite"
              className="max-w-[360px] whitespace-pre-wrap break-words rounded-[14px] bg-elevated px-3.5 py-3 text-[13px] text-fg"
            >
              {preview.isError
                ? t("agents.preview.error")
                : rendered || (preview.isFetching ? "…" : t("agents.preview.empty"))}
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-control bg-elevated px-3 py-2.5 text-xs text-fg-muted">
            <Info aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
            {t("agents.preview.note")}
          </div>
        </Panel>
      </div>
    </div>
  );
}
