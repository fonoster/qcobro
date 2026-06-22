import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { PageHeader } from "../components/page-header.js";
import { SectionCard } from "../components/section-card.js";

function sentimentVariant(s: string) {
  if (s === "POSITIVE") return "success";
  if (s === "NEGATIVE" || s === "HOSTILE") return "destructive";
  return "secondary";
}

function MetaRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900">{value}</span>
    </div>
  );
}

export function GestionDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();

  const query = trpc.campaigns.contactLog.get.useQuery({ id: id! });
  const g = query.data as
    | {
        id: string;
        agentType: string;
        outcome: string;
        contactedAt: string;
        durationSeconds: number | null;
        aiSummary: string | null;
        aiSentiment: string | null;
        aiDebtReason: string | null;
        aiResult: string | null;
        aiNextStep: string | null;
        channelData: Record<string, unknown> | null;
        debtAmountSnapshot: number | null;
        portfolioAccount: {
          fullName: string;
          externalId: string;
          phone: string | null;
          preferredLanguage: string | null;
          outstandingBalance: number;
        };
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

  const isVoice = g?.agentType === "VOICE_AI" || g?.agentType === "VOICE_PRERECORDED";
  const recordingUrl = g?.channelData?.recordingUrl as string | undefined;
  const transcript = g?.channelData?.transcriptText as string | undefined;
  const transcriptLines = transcript ? transcript.split("\n").filter(Boolean) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/gestiones")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("gestiones.detail.back")}
        </Button>
      </div>

      <PageHeader
        title={g?.portfolioAccount.fullName ?? "…"}
        description={g?.campaign?.name ?? undefined}
        action={
          g ? (
            <Badge variant="secondary">
              {t(`gestiones.outcome.${g.outcome}` as Parameters<typeof t>[0])}
            </Badge>
          ) : undefined
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 flex flex-col gap-6">
          {isVoice && recordingUrl && (
            <SectionCard title={t("gestiones.col.agent")}>
              <audio controls src={recordingUrl} className="w-full" />
            </SectionCard>
          )}

          {isVoice && (
            <SectionCard title={t("gestiones.detail.transcript")}>
              {transcriptLines.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {transcriptLines.map((line, i) => (
                    <div
                      key={i}
                      className={
                        i % 2 === 0
                          ? "self-start rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800"
                          : "self-end rounded-2xl rounded-tr-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                      }
                    >
                      {line}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("gestiones.detail.noTranscript")}</p>
              )}
            </SectionCard>
          )}

          <SectionCard title={t("gestiones.detail.analysis")}>
            <div className="flex flex-col gap-3 text-sm">
              {g?.aiSentiment && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{t("gestiones.detail.sentiment")}:</span>
                  <Badge variant={sentimentVariant(g.aiSentiment)}>
                    {t(`gestiones.sentiment.${g.aiSentiment}` as Parameters<typeof t>[0])}
                  </Badge>
                </div>
              )}
              {g?.aiSummary && (
                <p>
                  <span className="font-medium text-slate-700">
                    {t("gestiones.detail.summary")}:
                  </span>{" "}
                  {g.aiSummary}
                </p>
              )}
              {g?.aiDebtReason && (
                <p>
                  <span className="font-medium text-slate-700">
                    {t("gestiones.detail.debtReason")}:
                  </span>{" "}
                  {g.aiDebtReason}
                </p>
              )}
              {g?.aiResult && (
                <p>
                  <span className="font-medium text-slate-700">
                    {t("gestiones.detail.result")}:
                  </span>{" "}
                  {g.aiResult}
                </p>
              )}
              {g?.aiNextStep && (
                <p>
                  <span className="font-medium text-slate-700">
                    {t("gestiones.detail.nextStep")}:
                  </span>{" "}
                  {g.aiNextStep}
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard title={t("gestiones.detail.objectives")}>
            {g && g.objectives.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {g.objectives.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <Badge variant="secondary">
                      {t(`objetivos.type.${o.type}` as Parameters<typeof t>[0])}
                    </Badge>
                    <span className="text-slate-600">
                      {o.amount != null
                        ? new Intl.NumberFormat("es", {
                            style: "currency",
                            currency: "USD",
                            minimumFractionDigits: 0
                          }).format(o.amount)
                        : ""}{" "}
                      · {new Date(o.dueDate).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">{t("gestiones.detail.noObjectives")}</p>
            )}
          </SectionCard>
        </div>

        <SectionCard title={t("gestiones.detail.metadata")} className="self-start">
          <div className="flex flex-col">
            <MetaRow label={t("gestiones.detail.account")} value={g?.portfolioAccount.externalId} />
            <MetaRow label={t("gestiones.detail.phone")} value={g?.portfolioAccount.phone} />
            <MetaRow
              label={t("gestiones.detail.language")}
              value={g?.portfolioAccount.preferredLanguage}
            />
            <MetaRow
              label={t("gestiones.detail.balance")}
              value={
                g
                  ? new Intl.NumberFormat("es", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0
                    }).format(g.portfolioAccount.outstandingBalance)
                  : undefined
              }
            />
            <MetaRow
              label={t("gestiones.detail.duration")}
              value={g?.durationSeconds != null ? `${g.durationSeconds}s` : undefined}
            />
            <MetaRow
              label={t("gestiones.col.date")}
              value={g ? new Date(g.contactedAt).toLocaleString() : undefined}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
