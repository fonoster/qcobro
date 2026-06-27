import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, Sparkles, CheckCheck, PhoneCall, MessagesSquare, Target, Mail } from "lucide-react";
import type { EmailThreadMessage, TranscriptLine } from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { channelIcon, type Channel } from "../lib/channelIcon.js";

// EMAIL is bidirectional (autopilot thread); the other two are one-way sends.
const ONE_WAY: Channel[] = ["SMS", "VOICE_PRERECORDED"];

const currency = (n: number) =>
  new Intl.NumberFormat("es", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0
  }).format(n);

function Section({
  icon: Icon,
  iconClass,
  title,
  children
}: {
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function EmailHeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs text-slate-400">{label}</span>
      <span className="text-xs font-medium text-slate-600">{value}</span>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-700">{value}</span>
    </div>
  );
}

function formatDuration(seconds?: number | null): string | null {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function GestionDetailContent({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useI18n();

  const query = trpc.campaigns.contactLog.get.useQuery({ id });
  const g = query.data as
    | {
        id: string;
        agentType: Channel;
        outcome: string;
        contactedAt: string;
        durationSeconds: number | null;
        aiSummary: string | null;
        aiSentiment: string | null;
        aiDebtReason: string | null;
        aiResult: string | null;
        aiNextStep: string | null;
        channelData: Record<string, unknown> | null;
        portfolioAccount: { fullName: string; externalId: string; phone: string | null };
        campaign: { name: string } | null;
        objectives: {
          id: string;
          type: string;
          amount: number | null;
          dueDate: string;
          status: string;
        }[];
      }
    | undefined;

  const messageBody = g?.channelData?.messageBody as string | undefined;
  const subject = g?.channelData?.subject as string | undefined;
  const recordingUrl = g?.channelData?.recordingUrl as string | undefined;
  const transcript = (g?.channelData?.transcript as TranscriptLine[] | undefined) ?? [];
  const emailThread =
    (g?.channelData?.emailThread as { messages: EmailThreadMessage[] } | undefined) ?? null;
  const toNumber = (g?.channelData?.to as string | undefined) ?? g?.portfolioAccount.phone ?? null;
  const timeStr = g
    ? new Date(g.contactedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const durationStr = formatDuration(g?.durationSeconds);
  const oneWay = !!g && ONE_WAY.includes(g.agentType);
  const isVoiceAi = g?.agentType === "VOICE_AI";
  const isEmail = g?.agentType === "EMAIL";
  const ChannelIcon = g ? channelIcon(g.agentType) : channelIcon("SMS");

  // On-demand AI analysis: when a Voz IA gestión has a transcript but no analysis yet,
  // request generation once. The server no-ops if insights are disabled or already
  // analyzed; on success we refetch so the analysis renders.
  const utils = trpc.useUtils();
  const generateInsight = trpc.campaigns.contactLog.generateInsight.useMutation({
    onSuccess: () => utils.campaigns.contactLog.get.invalidate({ id })
  });
  const requestedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!g || g.agentType !== "VOICE_AI") return;
    if (transcript.length === 0 || g.aiSummary) return;
    if (requestedFor.current === id) return;
    requestedFor.current = id;
    generateInsight.mutate({ id });
  }, [g, id, transcript.length, generateInsight]);

  const hasAnalysis = !!(
    g &&
    (g.aiSummary || g.aiSentiment || g.aiDebtReason || g.aiResult || g.aiNextStep)
  );
  const analysisCells: [string, string][] = g
    ? ([
        g.aiSentiment
          ? [
              t("gestiones.detail.sentiment"),
              t(`gestiones.sentiment.${g.aiSentiment}` as Parameters<typeof t>[0])
            ]
          : null,
        g.aiDebtReason ? [t("gestiones.detail.debtReason"), g.aiDebtReason] : null,
        g.aiResult ? [t("gestiones.detail.result"), g.aiResult] : null,
        g.aiNextStep ? [t("gestiones.detail.nextStep"), g.aiNextStep] : null
      ].filter(Boolean) as [string, string][])
    : [];

  // One-way insight: real AI summary when present, otherwise a generic per-channel line.
  const insight = g
    ? (g.aiSummary ??
      (oneWay ? t(`gestiones.insight.${g.agentType}` as Parameters<typeof t>[0]) : null))
    : null;

  const sentTitle = g
    ? g.agentType === "EMAIL"
      ? t("gestiones.detail.emailComm")
      : g.agentType === "VOICE_PRERECORDED"
        ? t("gestiones.detail.playedMessage")
        : t("gestiones.detail.sentMessage")
    : "";

  const deliveryValue = g
    ? g.agentType === "EMAIL"
      ? t("gestiones.detail.delivered")
      : g.agentType === "VOICE_PRERECORDED"
        ? t("gestiones.detail.played")
        : t("gestiones.detail.sent")
    : "";

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold text-slate-900">{t("gestiones.detail.title")}</h1>
          <p className="text-sm text-slate-500">
            {g ? `${g.portfolioAccount.fullName} · ${g.portfolioAccount.externalId}` : "…"}
          </p>
        </div>
        <button
          type="button"
          aria-label={t("gestiones.detail.back")}
          onClick={onClose}
          className="text-slate-400 transition-colors hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-6 p-6">
        {/* Voz IA: call player */}
        {isVoiceAi && (
          <Section icon={PhoneCall} iconClass="text-emerald-700" title={t("gestiones.detail.call")}>
            <div className="rounded-xl bg-emerald-700 p-4 text-white">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <PhoneCall className="h-4 w-4" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{t("gestiones.detail.call")}</span>
                  <span className="text-xs text-emerald-100">
                    {t("agents.type.VOICE_AI")}
                    {g?.campaign?.name ? ` · ${g.campaign.name}` : ""}
                  </span>
                </div>
              </div>
              {recordingUrl ? (
                <audio controls src={recordingUrl} className="w-full" />
              ) : (
                <p className="text-xs text-emerald-100">
                  {t("gestiones.detail.recordingUnavailable")}
                </p>
              )}
            </div>
          </Section>
        )}

        {/* Voz IA: transcript */}
        {isVoiceAi && transcript.length > 0 && (
          <Section
            icon={MessagesSquare}
            iconClass="text-emerald-700"
            title={t("gestiones.detail.transcript")}
          >
            <div className="flex flex-col gap-2">
              {transcript.map((line, i) =>
                line.role === "agent" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-emerald-100 bg-emerald-50 px-3.5 py-2.5">
                      <span className="text-[11px] font-semibold text-emerald-700">
                        {t("gestiones.detail.agentSpeaker")}
                      </span>
                      <p className="text-sm leading-relaxed text-emerald-900">{line.text}</p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-100 px-3.5 py-2.5">
                      <span className="text-[11px] font-semibold text-slate-400">
                        {t("gestiones.detail.customerSpeaker")}
                      </span>
                      <p className="text-sm leading-relaxed text-slate-700">{line.text}</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </Section>
        )}

        {/* EMAIL: email-client card — initial notice header/body + reply thread */}
        {isEmail && (
          <Section
            icon={Mail}
            iconClass="text-emerald-700"
            title={t("gestiones.detail.emailThread")}
          >
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* Email header: De / Para / Asunto */}
              {(g?.channelData?.from || toNumber || subject) && (
                <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-3">
                  {g?.channelData?.from && (
                    <EmailHeaderRow
                      label={t("gestiones.detail.emailFrom")}
                      value={g.channelData.from as string}
                    />
                  )}
                  {toNumber && (
                    <EmailHeaderRow label={t("gestiones.detail.emailTo")} value={toNumber} />
                  )}
                  {subject && (
                    <EmailHeaderRow label={t("gestiones.detail.emailSubject")} value={subject} />
                  )}
                </div>
              )}
              {/* Original email body — split on double-newlines into paragraphs */}
              {messageBody ? (
                <div className="flex flex-col gap-2.5 px-4 py-4">
                  {messageBody.split(/\n{2,}/).map((para, i) => (
                    <p
                      key={i}
                      className="whitespace-pre-line text-sm leading-relaxed text-slate-600"
                    >
                      {para.trim()}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-4 text-sm text-slate-400">
                  {t("gestiones.detail.noMessage")}
                </p>
              )}
              {/* Reply thread messages */}
              {emailThread?.messages.map((m, i) =>
                m.direction === "inbound" ? (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 border-t border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {g?.portfolioAccount.fullName} {t("gestiones.detail.emailReplied")}
                      </span>
                      <span className="ml-auto text-[11px] text-slate-400">
                        {new Date(m.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                    {m.body ? (
                      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                        {m.body}
                      </p>
                    ) : (
                      <p className="text-sm italic text-slate-400">
                        {t("gestiones.detail.noMessage")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 border-t border-slate-200 bg-emerald-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-700">
                        {t("gestiones.detail.emailAgentName")}
                      </span>
                      <span className="ml-auto text-[11px] text-slate-400">
                        {new Date(m.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                      {m.body}
                    </p>
                  </div>
                )
              )}
              {/* Awaiting reply placeholder when no replies yet */}
              {(!emailThread || emailThread.messages.length === 0) && (
                <div className="border-t border-slate-200 px-4 py-3">
                  <p className="text-xs text-slate-400">{t("gestiones.detail.emailNoReply")}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* EMAIL: AI insights — outcome + optional LLM summary */}
        {isEmail && g && (
          <Section
            icon={Sparkles}
            iconClass="text-violet-600"
            title={t("gestiones.detail.emailAnalysis")}
          >
            <div className="flex flex-col gap-3">
              {g.aiSummary && (
                <p className="text-sm leading-relaxed text-slate-600">{g.aiSummary}</p>
              )}
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                <span className="text-sm text-slate-500">{t("gestiones.detail.result")}</span>
                <span className="text-sm font-medium text-slate-700">
                  {t(`gestiones.outcome.${g.outcome}` as Parameters<typeof t>[0])}
                </span>
              </div>
            </div>
          </Section>
        )}

        {/* Voz IA: full AI analysis */}
        {isVoiceAi && (
          <Section
            icon={Sparkles}
            iconClass="text-violet-600"
            title={t("gestiones.detail.analysis")}
          >
            {hasAnalysis ? (
              <div className="flex flex-col gap-3">
                {g?.aiSummary && (
                  <p className="text-sm leading-relaxed text-slate-600">{g.aiSummary}</p>
                )}
                {analysisCells.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {analysisCells.map(([label, value]) => (
                      <div key={label} className="flex flex-col gap-0.5 rounded-lg bg-slate-50 p-3">
                        <span className="text-xs text-slate-400">{label}</span>
                        <span className="text-sm font-medium text-slate-700">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {generateInsight.isPending
                  ? t("gestiones.detail.analysisGenerating")
                  : t("gestiones.detail.analysisPending")}
              </p>
            )}
          </Section>
        )}

        {/* Voz IA + EMAIL: linked objectives (promises captured by the autopilot) */}
        {(isVoiceAi || isEmail) && g && g.objectives.length > 0 && (
          <Section
            icon={Target}
            iconClass="text-emerald-700"
            title={t("gestiones.detail.objectives")}
          >
            <div className="flex flex-col gap-2">
              {g.objectives.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3"
                >
                  <Target className="h-5 w-5 shrink-0 text-emerald-700" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-emerald-900">
                      {t(`objetivos.type.${o.type}` as Parameters<typeof t>[0])}
                    </span>
                    <span className="text-sm text-emerald-700">
                      {o.amount != null ? `${currency(o.amount)} · ` : ""}
                      {new Date(o.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="ml-auto rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                    {t(`objetivos.status.${o.status}` as Parameters<typeof t>[0])}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* One-way channels: sent content */}
        {oneWay && (
          <Section icon={ChannelIcon} iconClass="text-emerald-700" title={sentTitle}>
            {!messageBody ? (
              <p className="text-sm text-slate-500">{t("gestiones.detail.noMessage")}</p>
            ) : g!.agentType === "SMS" ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-sm leading-relaxed text-emerald-900">{messageBody}</p>
                  <div className="mt-1 flex items-center justify-end gap-1 text-emerald-500">
                    <span className="text-[11px]">{timeStr}</span>
                    <CheckCheck className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            ) : g!.agentType === "VOICE_PRERECORDED" ? (
              <div className="flex flex-col gap-3">
                <audio
                  controls
                  className="w-full"
                  src={`/api/voice/tts?text=${encodeURIComponent(messageBody ?? "")}`}
                />
                <div className="rounded-lg border border-slate-200 px-4 py-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t("gestiones.detail.script")}
                  </p>
                  <p className="text-sm leading-relaxed text-slate-600">{messageBody}</p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                {subject && (
                  <div className="border-b border-slate-100 px-4 py-3">
                    <span className="text-xs text-slate-400">{t("gestiones.detail.subject")}</span>
                    <p className="text-sm font-medium text-slate-700">{subject}</p>
                  </div>
                )}
                <p className="whitespace-pre-line px-4 py-3 text-sm leading-relaxed text-slate-600">
                  {messageBody}
                </p>
              </div>
            )}
          </Section>
        )}

        {/* One-way channels: AI insight */}
        {oneWay && g && insight && (
          <Section
            icon={Sparkles}
            iconClass="text-violet-600"
            title={t("gestiones.detail.analysis")}
          >
            <p className="text-sm leading-relaxed text-slate-600">{insight}</p>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="text-sm text-slate-500">{t("gestiones.detail.result")}</span>
              <span className="text-sm font-medium text-slate-700">
                {t(`gestiones.outcome.${g.outcome}` as Parameters<typeof t>[0])}
              </span>
            </div>
          </Section>
        )}

        {/* Metadata */}
        {g && (
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("gestiones.detail.metadata")}
            </span>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <MetaItem
                label={t("gestiones.col.agent")}
                value={t(`agents.type.${g.agentType}` as Parameters<typeof t>[0])}
              />
              {oneWay && <MetaItem label={t("gestiones.detail.delivery")} value={deliveryValue} />}
              <MetaItem
                label={t("gestiones.col.date")}
                value={new Date(g.contactedAt).toLocaleString()}
              />
              {durationStr && (
                <MetaItem label={t("gestiones.detail.duration")} value={durationStr} />
              )}
              <MetaItem
                label={t("gestiones.detail.account")}
                value={g.portfolioAccount.externalId}
              />
              <MetaItem label={t("gestiones.col.campaign")} value={g.campaign?.name} />
              <MetaItem
                label={isEmail ? t("gestiones.detail.email") : t("gestiones.detail.phone")}
                value={toNumber}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function GestionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <GestionDetailContent id={id!} onClose={() => navigate("/gestiones")} />
      </div>
    </div>
  );
}
