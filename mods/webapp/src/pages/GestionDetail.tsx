import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Sparkles,
  CheckCheck,
  Copy,
  Check,
  MicOff,
  Download,
  Play,
  Pause,
  ExternalLink
} from "lucide-react";
import type { EmailThreadMessage, TranscriptLine, WhatsAppThread } from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { useMoney, useWorkspaceTimezone } from "../lib/useWorkspaceCurrency.js";
import type { Channel } from "../lib/channelIcon.js";
import { useContactLogRealtime } from "../lib/useContactLogRealtime.js";
import { useRecordingBlobUrl } from "../lib/useRecordingBlobUrl.js";
import { deliveryLabel, pathProgression, outcomeLabel } from "../lib/contactAxes.js";
import { cn } from "../lib/utils.js";
import { Drawer } from "../components/ui/drawer.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import {
  formatDuration,
  formatFullDate,
  formatListDate,
  formatPhone,
  formatReplyDate,
  formatWeekday,
  resolveTimeZone
} from "./gestionFormat.js";

type Key = Parameters<ReturnType<typeof useI18n>["t"]>[0];

type Gestion = {
  id: string;
  agentType: Channel;
  delivery: string;
  deliveryReason: string | null;
  path: string | null;
  outcome: string | null;
  contactedAt: string;
  durationSeconds: number | null;
  aiSummary: string | null;
  aiSentiment: string | null;
  aiDebtReason: string | null;
  aiResult: string | null;
  aiNextStep: string | null;
  channelData: Record<string, unknown> | null;
  // The apiserver path that streams the call recording (Bearer-authenticated), set only when
  // the call record has one. `null` otherwise.
  recordingUrl: string | null;
  portfolioAccount: {
    fullName: string;
    externalId: string;
    phone: string | null;
    email?: string | null;
    portfolioId: string;
  };
  campaign: { name: string } | null;
  paymentPromises: { id: string; amount: number | null; dueDate: string; status: string }[];
};

/** A muted uppercase 11 section label (TRANSCRIPCIÓN, METADATOS, GUION REPRODUCIDO). */
function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="text-[11px] uppercase tracking-[0.5px] text-fg-muted">{children}</span>;
}

function useCopy(value: string) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return { copied, copy };
}

function CopyButton({ value }: { value: string }) {
  const { t } = useI18n();
  const { copied, copy } = useCopy(value);
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? t("gestiones.detail.idCopied") : t("gestiones.detail.copyId")}
      className="cursor-pointer text-fg-muted transition-colors hover:text-fg"
    >
      {copied ? <Check className="h-[13px] w-[13px]" /> : <Copy className="h-[13px] w-[13px]" />}
    </button>
  );
}

/** One key/value row: label muted left, value right-aligned. */
function KvRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 text-[13px]">
      <span className="shrink-0 text-fg-muted">{label}</span>
      <span className="min-w-0 text-right text-fg">{children}</span>
    </div>
  );
}

// The design's waveform: 52 bars, a fixed pseudo-random profile.
const BARS = Array.from(
  { length: 52 },
  (_, i) => 4 + Math.round(Math.abs(Math.sin(i * 0.7) * 16 + Math.sin(i * 2.3) * 6))
);

/** The call recording: title + sub, download, a round play button, waveform and duration. */
function RecordingPlayer({
  src,
  title,
  sub,
  seconds
}: {
  src: string | undefined;
  title: string;
  sub: string;
  seconds: number | null;
}) {
  const { t } = useI18n();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [length, setLength] = useState<number | null>(seconds);
  const progress = length ? Math.min(1, current / length) : 0;

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audio.current;
    if (!el || !length) return;
    const box = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - box.left) / box.width) * length;
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-bg p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-medium text-fg">{title}</span>
          <span className="truncate text-xs text-fg-muted">{sub}</span>
        </div>
        {src && (
          <a
            href={src}
            download
            aria-label={t("gestiones.detail.download")}
            className="rounded-md p-1 text-fg-muted hover:bg-elevated hover:text-fg"
          >
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!src}
          aria-label={playing ? t("gestiones.detail.pause") : t("gestiones.detail.play")}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fg text-bg disabled:opacity-50"
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
          )}
        </button>
        <div
          aria-hidden
          onClick={seek}
          className="flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-0.5"
        >
          {BARS.map((h, i) => (
            <span
              key={i}
              style={{ height: h }}
              className={cn(
                "flex-1 rounded-[1px]",
                (i + 0.5) / BARS.length <= progress ? "bg-fg" : "bg-fg-subtle/60"
              )}
            />
          ))}
        </div>
        <span className="shrink-0 font-mono text-xs text-fg-muted">
          {formatDuration(playing || current > 0 ? current : length) ?? "0:00"}
        </span>
      </div>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setLength(d);
        }}
      />
    </div>
  );
}

function NoRecording() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-card border border-border bg-bg p-5 text-center">
      <MicOff className="h-[18px] w-[18px] text-fg-muted" />
      <span className="text-[13px] font-medium text-fg">
        {t("gestiones.detail.recordingUnavailable")}
      </span>
      <span className="text-xs text-fg-muted">
        {t("gestiones.detail.recordingUnavailableExplanation")}
      </span>
    </div>
  );
}

/** A sent message as a neutral card: optional header rows, paragraphs, optional footer. */
function MessageCard({
  head,
  body,
  foot
}: {
  head?: [string, ReactNode][];
  body: string | undefined;
  foot?: ReactNode;
}) {
  const { t } = useI18n();
  const rows = (head ?? []).filter(([, v]) => v);
  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-border bg-bg p-4">
      {rows.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {rows.map(([k, v]) => (
              <KvRow key={k} label={k}>
                {v}
              </KvRow>
            ))}
          </div>
          <div className="h-px bg-border" />
        </>
      )}
      {body ? (
        body.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="whitespace-pre-line text-[13px] leading-relaxed text-fg">
            {para.trim()}
          </p>
        ))
      ) : (
        <p className="text-[13px] text-fg-muted">{t("gestiones.detail.noMessage")}</p>
      )}
      {foot && <div className="flex items-center justify-end gap-1.5 text-fg-muted">{foot}</div>}
    </div>
  );
}

/** A thread reply: the customer's bordered, the agent's on a muted fill. */
function Reply({
  who,
  when,
  text,
  agent
}: {
  who: string;
  when: string;
  text: string;
  agent: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-[10px] px-3.5 py-3",
        agent ? "bg-elevated" : "border border-border bg-bg"
      )}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-fg">{who}</span>
        <span className="text-fg-muted">{when}</span>
      </div>
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-fg">{text}</p>
    </div>
  );
}

export function GestionDetailContent({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, language } = useI18n();
  const money = useMoney();
  const navigate = useNavigate();
  const timeZone = resolveTimeZone(useWorkspaceTimezone());
  const dateWords = { today: t("gestiones.date.today"), yesterday: t("gestiones.date.yesterday") };

  // Realtime-streaming capability: the open gestión updates in place — delivery status,
  // transcript/recording, AI insights, inbound replies, payment-promise changes — without
  // the operator reloading.
  useContactLogRealtime(id);

  const query = trpc.campaigns.contactLog.get.useQuery({ id });
  const g = query.data as Gestion | undefined;

  const messageBody = g?.channelData?.messageBody as string | undefined;
  const fromAddr = g?.channelData?.from as string | undefined;
  const subject = g?.channelData?.subject as string | undefined;
  // The recording endpoint needs the caller's credentials, which `<audio src>` can't send:
  // fetch it and play a blob URL instead.
  const recording = useRecordingBlobUrl(g?.recordingUrl);
  const hasRecording = !!g?.recordingUrl && !recording.failed;
  const transcript = (g?.channelData?.transcript as TranscriptLine[] | undefined) ?? [];
  const emailThread =
    (g?.channelData?.emailThread as { messages: EmailThreadMessage[] } | undefined) ?? null;
  const whatsAppThread = (g?.channelData?.whatsAppThread as WhatsAppThread | undefined) ?? null;
  const toAddr = (g?.channelData?.to as string | undefined) ?? null;

  const isVoiceAi = g?.agentType === "VOICE_AI";
  const isPrerecorded = g?.agentType === "VOICE_PRERECORDED";
  const isEmail = g?.agentType === "EMAIL";
  const isWhatsApp = g?.agentType === "WHATSAPP";
  const isSms = g?.agentType === "SMS";

  // On-demand AI analysis: when a Voz IA call (transcript) or an EMAIL/WhatsApp thread that
  // has at least one customer reply lacks analysis, request generation once. The server
  // no-ops if insights are disabled or already analyzed; on success we refetch.
  const utils = trpc.useUtils();
  const generateInsight = trpc.campaigns.contactLog.generateInsight.useMutation({
    onSuccess: () => utils.campaigns.contactLog.get.invalidate({ id })
  });
  const requestedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!g || g.aiSummary) return;
    const hasVoice = g.agentType === "VOICE_AI" && transcript.length > 0;
    const hasEmailReplies = g.agentType === "EMAIL" && (emailThread?.messages.length ?? 0) > 0;
    const hasWhatsAppReplies =
      g.agentType === "WHATSAPP" && (whatsAppThread?.messages.length ?? 0) > 0;
    if (!hasVoice && !hasEmailReplies && !hasWhatsAppReplies) return;
    if (requestedFor.current === id) return;
    requestedFor.current = id;
    generateInsight.mutate({ id });
  }, [g, id, transcript.length, emailThread, whatsAppThread, generateInsight]);

  if (!g) {
    return (
      <Drawer open onClose={onClose} width={560} title="…" footer={null}>
        <p className="text-[13px] text-fg-muted">{t("common.loading")}</p>
      </Drawer>
    );
  }

  const channel = t(`gestiones.channel.${g.agentType}` as Key);
  const when = formatListDate(g.contactedAt, language, timeZone, dateWords);
  const sentTime = new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone
  }).format(new Date(g.contactedAt));

  // The three axes, straight off typed columns.
  const deliveryValue = deliveryLabel(t, g.delivery, g.deliveryReason, g.agentType);
  const pathValue = pathProgression(t, g.agentType, g.path, g.channelData);
  const promise = g.paymentPromises?.[0] ?? null;
  // A linked promise is shown even when `outcome` is null: historical gestiones on the
  // one-way channels had their `outcome` cleared by the axes migration, but their promises
  // are still on the operator worklist.
  const outcomeValue =
    outcomeLabel(t, g.outcome) ?? (promise ? t("gestiones.detail.paymentPromise") : null);

  // Insight text: the AI summary when present; otherwise a per-channel line (one-way
  // channels) or the analysis state (Voz IA).
  const generating = generateInsight.isPending;
  const insightText =
    g.aiSummary ??
    (isSms || isPrerecorded
      ? t(`gestiones.insight.${g.agentType}` as Key)
      : generating
        ? t("gestiones.detail.analysisGenerating")
        : isVoiceAi
          ? t("gestiones.detail.analysisPending")
          : null);

  const outcomeCells: [string, ReactNode][] = [];
  if (outcomeValue) outcomeCells.push([t("gestiones.detail.result"), outcomeValue]);
  if (g.aiSentiment) {
    outcomeCells.push([
      t("gestiones.detail.sentiment"),
      t(`gestiones.sentiment.${g.aiSentiment}` as Key)
    ]);
  }
  if (promise) {
    const detail = [
      promise.amount != null ? money(promise.amount) : null,
      formatWeekday(promise.dueDate, language, timeZone)
    ]
      .filter(Boolean)
      .join(" · ");
    outcomeCells.push([
      t("gestiones.detail.promise"),
      <span key="promise" className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono">{detail}</span>
        <span className="text-fg-muted">·</span>
        {/* Its own element: the open drawer must reflect a promise resolved elsewhere. */}
        <span>{t(`paymentPromises.status.${promise.status}` as Key)}</span>
      </span>
    ]);
  }
  const extraLines: [string, string][] = [
    g.aiDebtReason ? [t("gestiones.detail.debtReason"), g.aiDebtReason] : null,
    g.aiNextStep ? [t("gestiones.detail.nextStep"), g.aiNextStep] : null
  ].filter(Boolean) as [string, string][];
  const showInsight = !!insightText || outcomeCells.length > 0 || extraLines.length > 0;

  const recordingSub = [t(`agents.type.${g.agentType}` as Key), g.campaign?.name]
    .filter(Boolean)
    .join(" · ");
  const accountPhone = formatPhone(toAddr ?? g.portfolioAccount.phone);
  const replyWhen = (at: string) => formatReplyDate(at, language, timeZone, dateWords);
  const sentFoot = (
    <>
      <span className="text-xs">{sentTime}</span>
      <CheckCheck className="h-3.5 w-3.5" />
    </>
  );

  const thread = isEmail ? emailThread?.messages : isWhatsApp ? whatsAppThread?.messages : null;
  const agentName = isEmail
    ? t("gestiones.detail.emailAgentName")
    : t("gestiones.detail.whatsAppAgent");

  return (
    <Drawer
      open
      onClose={onClose}
      width={560}
      title={g.portfolioAccount.fullName}
      subtitle={[
        t("gestiones.detail.accountRef").replace("{id}", g.portfolioAccount.externalId),
        channel,
        when
      ].join(" · ")}
      headerExtra={
        <div className="flex flex-wrap items-center gap-2 pt-1.5">
          <Badge className="rounded-md px-2 py-[3px] text-xs">{deliveryValue}</Badge>
          {outcomeValue && (
            <Badge className="rounded-md px-2 py-[3px] text-xs">{outcomeValue}</Badge>
          )}
        </div>
      }
      footerLeft={
        <span className="flex items-center gap-1.5 text-xs">
          {t("gestiones.detail.gestionId")} <span className="font-mono">{g.id.slice(0, 8)}…</span>
          <CopyButton value={g.id} />
        </span>
      }
      footer={
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(`/portfolios/${g.portfolioAccount.portfolioId}`)}
        >
          <ExternalLink className="h-4 w-4" />
          {t("gestiones.detail.viewAccount")}
        </Button>
      }
    >
      {/* Voz IA + Voz pregrabada: always the actual call recording, never a re-synthesized
          stand-in for what was said. */}
      {(isVoiceAi || isPrerecorded) &&
        (hasRecording ? (
          <RecordingPlayer
            src={recording.src}
            title={t("gestiones.detail.call")}
            sub={recordingSub}
            seconds={g.durationSeconds}
          />
        ) : (
          <NoRecording />
        ))}

      {isVoiceAi && transcript.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>{t("gestiones.detail.transcript")}</SectionLabel>
          {transcript.map((line, i) => {
            const agent = line.role === "agent";
            return (
              <div
                key={i}
                className={cn(
                  "flex flex-col gap-1 rounded-[10px] px-3 py-2.5",
                  agent ? "bg-elevated" : "border border-border"
                )}
              >
                <span className="font-mono text-[11px] text-fg-muted">
                  {agent
                    ? t("gestiones.detail.agentSpeaker")
                    : t("gestiones.detail.customerSpeaker")}
                </span>
                <p className="text-[13px] leading-relaxed text-fg">{line.text}</p>
              </div>
            );
          })}
        </section>
      )}

      {isPrerecorded && messageBody && (
        <section className="flex flex-col gap-2">
          <SectionLabel>{t("gestiones.detail.playedMessage")}</SectionLabel>
          <p className="text-[13px] leading-relaxed text-fg">{messageBody}</p>
        </section>
      )}

      {isSms && <MessageCard body={messageBody} foot={sentFoot} />}

      {isEmail && (
        <MessageCard
          head={[
            [t("gestiones.detail.emailFrom"), fromAddr],
            [t("gestiones.detail.emailTo"), toAddr],
            [t("gestiones.detail.emailSubject"), subject]
          ]}
          body={messageBody}
        />
      )}

      {isWhatsApp && (
        <MessageCard
          head={[
            [
              t("gestiones.detail.number"),
              fromAddr ? <span className="font-mono text-xs">{formatPhone(fromAddr)}</span> : null
            ],
            [
              t("gestiones.detail.customer"),
              toAddr ? <span className="font-mono text-xs">{formatPhone(toAddr)}</span> : null
            ]
          ]}
          body={messageBody}
          foot={sentFoot}
        />
      )}

      {thread &&
        thread.map((m, i) => {
          const inbound = m.direction === "inbound";
          return (
            <Reply
              key={i}
              agent={!inbound}
              who={
                inbound
                  ? isEmail
                    ? `${g.portfolioAccount.fullName} ${t("gestiones.detail.emailReplied")}`
                    : g.portfolioAccount.fullName
                  : agentName
              }
              when={replyWhen(m.at)}
              text={m.body || t("gestiones.detail.noMessage")}
            />
          );
        })}
      {(isEmail || isWhatsApp) && (!thread || thread.length === 0) && (
        <p className="text-xs text-fg-muted">
          {isEmail ? t("gestiones.detail.emailNoReply") : t("gestiones.detail.whatsAppNoReply")}
        </p>
      )}

      {showInsight && (
        <div className="flex flex-col gap-2.5 rounded-xl bg-elevated p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-fg" />
            <span className="text-[13px] font-medium text-fg">
              {t(`gestiones.insightTitle.${g.agentType}` as Key)}
            </span>
          </div>
          {insightText && (
            <p className="text-[13px] leading-relaxed text-fg-muted">{insightText}</p>
          )}
          {outcomeCells.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
              {outcomeCells.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <span className="text-[11px] uppercase tracking-[0.5px] text-fg-muted">
                    {label}
                  </span>
                  <span className="text-[13px] text-fg">{value}</span>
                </div>
              ))}
            </div>
          )}
          {extraLines.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.5px] text-fg-muted">{label}</span>
              <span className="text-[13px] text-fg">{value}</span>
            </div>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <SectionLabel>{t("gestiones.detail.metadata")}</SectionLabel>
        <div className="flex flex-col gap-3">
          <KvRow label={t("gestiones.detail.delivery")}>{deliveryValue}</KvRow>
          {pathValue && <KvRow label={t("gestiones.detail.path")}>{pathValue}</KvRow>}
          <KvRow label={t("gestiones.col.date")}>
            {formatFullDate(g.contactedAt, language, timeZone)}
          </KvRow>
          {formatDuration(g.durationSeconds) && (
            <KvRow label={t("gestiones.detail.duration")}>
              <span className="font-mono text-xs">{formatDuration(g.durationSeconds)}</span>
            </KvRow>
          )}
          {g.campaign?.name && <KvRow label={t("gestiones.col.campaign")}>{g.campaign.name}</KvRow>}
          {isEmail
            ? toAddr && <KvRow label={t("gestiones.detail.destinationEmail")}>{toAddr}</KvRow>
            : !isWhatsApp &&
              accountPhone && (
                <KvRow label={t("gestiones.detail.destinationNumber")}>
                  <span className="font-mono text-xs">{accountPhone}</span>
                </KvRow>
              )}
          <KvRow label={t("gestiones.detail.account")}>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono text-xs">{g.portfolioAccount.externalId}</span>
              <CopyButton value={g.portfolioAccount.externalId} />
            </span>
          </KvRow>
        </div>
      </section>
    </Drawer>
  );
}

/** The gestión drawer (560): opened from the Gestiones list by `?gestion=<id>`. */
export function GestionDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  return id ? <GestionDetailContent key={id} id={id} onClose={onClose} /> : null;
}

/** `/gestiones/:id` deep links open the drawer over the list. */
export function GestionDetail() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/gestiones?gestion=${encodeURIComponent(id ?? "")}`} replace />;
}
