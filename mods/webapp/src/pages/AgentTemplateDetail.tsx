import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { PageHeader } from "../components/page-header.js";
import { SectionCard } from "../components/section-card.js";
import { KpiRow } from "../components/kpi-card.js";

function ConfigRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-2 last:border-0">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="whitespace-pre-wrap text-sm text-slate-900">{value}</span>
    </div>
  );
}

export function AgentTemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();

  const query = trpc.agentTemplates.get.useQuery({ id: id! });
  const tmpl = query.data as
    | {
        id: string;
        name: string;
        type: string;
        collectionStrategy: string;
        totalCalls: number;
        totalPromises: number;
        totalRecovered: number;
        successRate: number;
        voiceAiConfig: Record<string, string | null> | null;
        voicePrerecordedConfig: Record<string, string | null> | null;
        smsConfig: Record<string, string | null> | null;
        emailConfig: Record<string, string | null> | null;
        whatsAppConfig: Record<string, string | null> | null;
        campaigns: { id: string; name: string; status: string }[];
      }
    | undefined;

  const isVoice = tmpl?.type === "VOICE_AI" || tmpl?.type === "VOICE_PRERECORDED";
  const voiceCfg = tmpl?.voiceAiConfig ?? tmpl?.voicePrerecordedConfig ?? null;
  const synced = voiceCfg?.fonosterAppRef != null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/agent-templates")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("agents.detail.back")}
        </Button>
      </div>

      <PageHeader
        title={tmpl?.name ?? "…"}
        description={tmpl ? t(`agents.type.${tmpl.type}` as Parameters<typeof t>[0]) : undefined}
        action={
          isVoice ? (
            <Badge variant={synced ? "success" : "orange"}>
              {synced ? t("agents.sync.synced") : t("agents.sync.pending")}
            </Badge>
          ) : undefined
        }
      />

      {tmpl && (
        <KpiRow
          cards={[
            { label: t("agents.kpi.calls"), value: tmpl.totalCalls.toLocaleString() },
            { label: t("agents.kpi.promises"), value: tmpl.totalPromises.toLocaleString() },
            {
              label: t("agents.kpi.recovered"),
              value: new Intl.NumberFormat("es", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0
              }).format(tmpl.totalRecovered)
            },
            {
              label: t("agents.kpi.successRate"),
              value: `${Math.round(tmpl.successRate * 100)}%`
            }
          ]}
        />
      )}

      <SectionCard title={t("agents.detail.config")}>
        <div className="flex flex-col">
          <ConfigRow
            label={t("agents.form.strategy")}
            value={
              tmpl && t(`agents.strategy.${tmpl.collectionStrategy}` as Parameters<typeof t>[0])
            }
          />
          {voiceCfg && (
            <>
              <ConfigRow label={t("agents.form.voice")} value={voiceCfg.voice} />
              <ConfigRow label={t("agents.form.language")} value={voiceCfg.language} />
              <ConfigRow label={t("agents.form.systemPrompt")} value={voiceCfg.systemPrompt} />
              <ConfigRow label={t("agents.form.script")} value={voiceCfg.script} />
              <ConfigRow label={t("agents.form.firstMessage")} value={voiceCfg.firstMessage} />
            </>
          )}
          {tmpl?.smsConfig && (
            <ConfigRow label={t("agents.form.messageBody")} value={tmpl.smsConfig.messageBody} />
          )}
          {tmpl?.emailConfig && (
            <>
              <ConfigRow label={t("agents.form.subject")} value={tmpl.emailConfig.subject} />
              <ConfigRow
                label={t("agents.form.messageBody")}
                value={tmpl.emailConfig.messageBody}
              />
              <ConfigRow label={t("agents.form.fromName")} value={tmpl.emailConfig.fromName} />
              <ConfigRow label={t("agents.form.fromEmail")} value={tmpl.emailConfig.fromEmail} />
            </>
          )}
          {tmpl?.whatsAppConfig && (
            <>
              <ConfigRow
                label={t("agents.form.templateName")}
                value={tmpl.whatsAppConfig.templateName}
              />
              <ConfigRow
                label={t("agents.form.messageBody")}
                value={tmpl.whatsAppConfig.messageBody}
              />
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title={t("agents.detail.campaigns")}>
        {tmpl && tmpl.campaigns.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {tmpl.campaigns.map((c) => (
              <li
                key={c.id}
                className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50"
                onClick={() => navigate(`/campaigns/${c.id}`)}
              >
                <span className="text-sm text-slate-900">{c.name}</span>
                <Badge variant="secondary">
                  {t(`campaigns.status.${c.status}` as Parameters<typeof t>[0])}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{t("agents.detail.noCampaigns")}</p>
        )}
      </SectionCard>
    </div>
  );
}
