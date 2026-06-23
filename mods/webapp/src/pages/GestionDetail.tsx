import type { ComponentType, ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, Sparkles, CheckCheck, Play } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { channelIcon, type Channel } from "../lib/channelIcon.js";

const ONE_WAY: Channel[] = ["SMS", "VOICE_PRERECORDED", "EMAIL"];

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
        channelData: Record<string, unknown> | null;
        portfolioAccount: { fullName: string; externalId: string; phone: string | null };
        campaign: { name: string } | null;
      }
    | undefined;

  const messageBody = g?.channelData?.messageBody as string | undefined;
  const subject = g?.channelData?.subject as string | undefined;
  const toNumber = (g?.channelData?.to as string | undefined) ?? g?.portfolioAccount.phone ?? null;
  const timeStr = g
    ? new Date(g.contactedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const durationStr = formatDuration(g?.durationSeconds);
  const oneWay = !!g && ONE_WAY.includes(g.agentType);
  const ChannelIcon = g ? channelIcon(g.agentType) : channelIcon("SMS");

  // Insight: real AI summary when present (Voz IA); otherwise a generic per-channel line
  // for one-way channels (no conversation to analyse — see gestiones.insight.*).
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
        {/* Sent content (one-way channels) */}
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
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Play className="h-4 w-4" />
                  </span>
                  <div className="h-1 flex-1 rounded-full bg-slate-200">
                    <div className="h-1 w-2/3 rounded-full bg-emerald-500" />
                  </div>
                  {durationStr && <span className="text-xs text-slate-500">{durationStr}</span>}
                </div>
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

        {/* AI insight */}
        {g && insight && (
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
              <MetaItem label={t("gestiones.detail.phone")} value={toNumber} />
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
