import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  X,
  Sparkles,
  CheckCheck,
  PhoneCall,
  MessagesSquare,
  Mail,
  MessageSquare,
  Copy,
  Check
} from "lucide-react";
import type { EmailThreadMessage, TranscriptLine, WhatsAppThread } from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { useMoney } from "../lib/useWorkspaceCurrency.js";
import { channelIcon, type Channel } from "../lib/channelIcon.js";
import { useContactLogRealtime } from "../lib/useContactLogRealtime.js";
import { entregaLabel, caminoPath, resultadoLabel } from "../lib/contactAxes.js";
import { ResultadoRow } from "../components/ResultadoRow.js";

// EMAIL is bidirectional (autopilot thread); the other two are one-way sends.
const ONE_WAY: Channel[] = ["SMS", "VOICE_PRERECORDED"];

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

/** Values longer than this are shown as a prefix + ellipsis in {@link CopyableMetaItem}. */
const ID_TRUNCATE_LENGTH = 8;

/**
 * Metadata field for an identifier that can be long (Gestión UUID, account external id):
 * shows the value truncated to {@link ID_TRUNCATE_LENGTH} chars (only when it actually
 * exceeds that length) with a copy control that writes the full value to the clipboard.
 * The raw value is often too long for the half-width metadata column, and operators only
 * need it to copy for correlation/support.
 */
function CopyableMetaItem({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const displayValue =
    value.length > ID_TRUNCATE_LENGTH ? `${value.slice(0, ID_TRUNCATE_LENGTH)}…` : value;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sm font-medium text-slate-700">{displayValue}</span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? t("gestiones.detail.idCopied") : t("gestiones.detail.copyId")}
          className="text-slate-400 transition-colors hover:text-slate-600"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
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
  const money = useMoney();

  // Realtime-streaming capability: the open gestión updates in place — delivery status,
  // transcript/recording, AI insights, inbound replies, payment-promise changes — without
  // the operator reloading.
  useContactLogRealtime(id);

  const query = trpc.campaigns.contactLog.get.useQuery({ id });
  const g = query.data as
    | {
        id: string;
        agentType: Channel;
        entrega: string;
        deliveryReason: string | null;
        camino: string | null;
        resultado: string | null;
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
        paymentPromises: {
          id: string;
          amount: number | null;
          dueDate: string;
          status: string;
        }[];
      }
    | undefined;

  const messageBody = g?.channelData?.messageBody as string | undefined;
  const fromEmail = g?.channelData?.from as string | undefined;
  const subject = g?.channelData?.subject as string | undefined;
  // Resolved server-side from the deployment's Fonoster recording template and the
  // provider call ref, falling back to whatever URL the provider reported at completion.
  const recordingUrl = g?.recordingUrl ?? undefined;
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
  const isWhatsApp = g?.agentType === "WHATSAPP";
  const whatsAppThread = (g?.channelData?.whatsAppThread as WhatsAppThread | undefined) ?? null;
  // Every channel except Voz IA and WhatsApp (both have dedicated sections) shows a
  // generic per-channel insight line via the shared hasGenericInsight block.
  const hasGenericInsight = !!g && !isVoiceAi && !isEmail && !isWhatsApp;
  const ChannelIcon = g ? channelIcon(g.agentType) : channelIcon("SMS");

  // On-demand AI analysis: when a Voz IA call (transcript) or an EMAIL thread that
  // has at least one customer reply lacks analysis, request generation once. The
  // server no-ops if insights are disabled or already analyzed; on success we refetch
  // so the analysis renders.
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
  }, [g, id, transcript.length, emailThread, generateInsight]);

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

  // Per-channel insight: real AI summary when present, otherwise a generic per-channel line.
  const insight = g
    ? (g.aiSummary ??
      (hasGenericInsight ? t(`gestiones.insight.${g.agentType}` as Parameters<typeof t>[0]) : null))
    : null;

  const sentTitle = g
    ? g.agentType === "EMAIL"
      ? t("gestiones.detail.emailComm")
      : g.agentType === "VOICE_PRERECORDED"
        ? t("gestiones.detail.playedMessage")
        : t("gestiones.detail.sentMessage")
    : "";

  // The three axes, straight off typed columns. This replaced a switch that reverse-engineered
  // delivery from untyped channelData plus string sniffing, transcript length, and the outcome.
  const entregaValue = g ? entregaLabel(t, g.entrega, g.deliveryReason, g.agentType) : "";
  const caminoValue = g
    ? caminoPath(t, g.agentType, g.camino, g.channelData as Record<string, unknown> | null)
    : null;
  const resultadoValue = g ? resultadoLabel(t, g.resultado) : null;
  const promise = g?.paymentPromises?.[0] ?? null;

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
              {(fromEmail || toNumber || subject) && (
                <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-3">
                  {fromEmail && (
                    <EmailHeaderRow label={t("gestiones.detail.emailFrom")} value={fromEmail} />
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

        {/* WHATSAPP: conversation thread — template opener + customer/agent replies */}
        {isWhatsApp && (
          <Section
            icon={MessageSquare}
            iconClass="text-emerald-700"
            title={t("gestiones.detail.whatsAppThread")}
          >
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* Initial template message */}
              {messageBody && (
                <div className="flex flex-col gap-2.5 bg-emerald-50 px-4 py-4">
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {t("gestiones.detail.whatsAppAgent")}
                  </span>
                  {messageBody.split(/\n{2,}/).map((para, i) => (
                    <p
                      key={i}
                      className="whitespace-pre-line text-sm leading-relaxed text-slate-600"
                    >
                      {para.trim()}
                    </p>
                  ))}
                </div>
              )}

              {/* Reply thread messages */}
              {whatsAppThread?.messages.map((m, i) =>
                m.direction === "inbound" ? (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 border-t border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {g?.portfolioAccount.fullName}
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
                ) : (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 border-t border-slate-200 bg-emerald-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-700">
                        {t("gestiones.detail.whatsAppAgent")}
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

              {/* No replies placeholder */}
              {(!whatsAppThread || whatsAppThread.messages.length === 0) && (
                <div className="border-t border-slate-200 px-4 py-3">
                  <p className="text-xs text-slate-400">{t("gestiones.detail.whatsAppNoReply")}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* WHATSAPP: AI insights */}
        {isWhatsApp && g && (
          <Section
            icon={Sparkles}
            iconClass="text-violet-600"
            title={t("gestiones.detail.whatsAppAnalysis")}
          >
            <div className="flex flex-col gap-3">
              {g.aiSummary ? (
                <p className="text-sm leading-relaxed text-slate-600">{g.aiSummary}</p>
              ) : generateInsight.isPending ? (
                <p className="text-sm text-slate-500">{t("gestiones.detail.analysisGenerating")}</p>
              ) : null}
            </div>
          </Section>
        )}

        {/* EMAIL: AI insights */}
        {isEmail && g && (
          <Section
            icon={Sparkles}
            iconClass="text-violet-600"
            title={t("gestiones.detail.emailAnalysis")}
          >
            <div className="flex flex-col gap-3">
              {g.aiSummary ? (
                <p className="text-sm leading-relaxed text-slate-600">{g.aiSummary}</p>
              ) : generateInsight.isPending ? (
                <p className="text-sm text-slate-500">{t("gestiones.detail.analysisGenerating")}</p>
              ) : null}
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

        {/* Per-channel insight (all channels except the Voz IA transcript analysis) */}
        {hasGenericInsight && insight && (
          <Section
            icon={Sparkles}
            iconClass="text-violet-600"
            title={t("gestiones.detail.analysis")}
          >
            <p className="text-sm leading-relaxed text-slate-600">{insight}</p>
          </Section>
        )}

        {/* Resultado — a standalone row, never nested in the AI section, so it is shown
            whether or not an analysis exists. Absent entirely when nothing came of the
            interaction, which is the common case. When it is a payment promise this row is
            the promise: there is no second card repeating it. */}
        <ResultadoRow
          label={t("gestiones.detail.result")}
          // A linked promise is shown even when `resultado` is null. Historical gestións on
          // the one-way channels had their `resultado` cleared by the axes migration (those
          // channels cannot carry one), but their `PaymentPromise` rows survive and are still
          // on the operator worklist — keying the row purely off `resultado` would make those
          // promises invisible here while the worklist kept chasing them.
          value={resultadoValue ?? (promise ? t("gestiones.detail.paymentPromise") : null)}
          promise={
            promise
              ? {
                  amount: promise.amount != null ? money(promise.amount) : null,
                  dueDate: new Date(promise.dueDate).toLocaleDateString(),
                  status: t(`paymentPromises.status.${promise.status}` as Parameters<typeof t>[0])
                }
              : null
          }
        />

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
              <MetaItem label={t("gestiones.detail.delivery")} value={entregaValue} />
              {caminoValue && <MetaItem label={t("gestiones.detail.camino")} value={caminoValue} />}
              <MetaItem
                label={t("gestiones.col.date")}
                value={new Date(g.contactedAt).toLocaleString()}
              />
              {durationStr && (
                <MetaItem label={t("gestiones.detail.duration")} value={durationStr} />
              )}
              <CopyableMetaItem
                label={t("gestiones.detail.account")}
                value={g.portfolioAccount.externalId}
              />
              <MetaItem label={t("gestiones.col.campaign")} value={g.campaign?.name} />
              <MetaItem
                label={isEmail ? t("gestiones.detail.email") : t("gestiones.detail.phone")}
                value={toNumber}
              />
              <CopyableMetaItem label={t("gestiones.detail.gestionId")} value={g.id} />
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
