import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { PageHeader } from "../components/page-header.js";
import { SectionCard } from "../components/section-card.js";

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
        voiceAiConfig: Record<string, string | null> | null;
        voicePrerecordedConfig: Record<string, string | null> | null;
        smsConfig: Record<string, string | null> | null;
        emailConfig: Record<string, string | null> | null;
        whatsAppConfig: Record<string, string | null> | null;
        campaigns: { id: string; name: string; status: string }[];
      }
    | undefined;

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

  // Resolve the stored voice id to its catalog label (name, language, gender).
  const voiceEntry = voices?.find((v) => v.id === voiceCfg?.voice);
  const voiceLabel = voiceEntry
    ? `${voiceEntry.name} (${voiceEntry.language}, ${t(`agents.gender.${voiceEntry.gender}` as Parameters<typeof t>[0])})`
    : (voiceCfg?.voice ?? null);

  // Map the stored language code (e.g. "es") to its human-friendly label.
  const languageLabel = voiceCfg?.language
    ? (t(`agents.lang.${voiceCfg.language}` as Parameters<typeof t>[0]) ?? voiceCfg.language)
    : null;

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
          syncsWithFonoster && tmpl ? (
            <div className="flex items-center gap-3">
              <Badge variant={syncError ? "destructive" : synced ? "success" : "orange"}>
                {syncError
                  ? t("agents.sync.error")
                  : synced
                    ? t("agents.sync.synced")
                    : t("agents.sync.pending")}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={sync.isPending}
                onClick={() => sync.mutate({ id: tmpl.id })}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                {t("agents.sync.action")}
              </Button>
            </div>
          ) : undefined
        }
      />

      <SectionCard title={t("agents.detail.config")}>
        <div className="flex flex-col">
          {voiceCfg && (
            <>
              <ConfigRow label={t("agents.form.language")} value={languageLabel} />
              <ConfigRow label={t("agents.form.voice")} value={voiceLabel} />
              <ConfigRow label={t("agents.form.firstMessage")} value={voiceCfg.firstMessage} />
              <ConfigRow label={t("agents.form.systemPrompt")} value={voiceCfg.systemPrompt} />
              <ConfigRow label={t("agents.form.script")} value={voiceCfg.script} />
            </>
          )}
          {tmpl?.smsConfig && (
            <>
              <ConfigRow label={t("agents.form.messageBody")} value={tmpl.smsConfig.messageBody} />
              <ConfigRow label={t("agents.form.senderId")} value={tmpl.smsConfig.senderId} />
            </>
          )}
          {tmpl?.emailConfig && (
            <>
              <ConfigRow label={t("agents.form.fromName")} value={tmpl.emailConfig.fromName} />
              <ConfigRow label={t("agents.form.fromEmail")} value={tmpl.emailConfig.fromEmail} />
              <ConfigRow label={t("agents.form.subject")} value={tmpl.emailConfig.subject} />
              <ConfigRow
                label={t("agents.form.messageBody")}
                value={tmpl.emailConfig.messageBody}
              />
              <ConfigRow
                label={t("agents.form.systemPrompt")}
                value={tmpl.emailConfig.systemPrompt}
              />
              <ConfigRow
                label={t("agents.form.maxReplies")}
                value={
                  tmpl.emailConfig.maxReplies != null ? String(tmpl.emailConfig.maxReplies) : null
                }
              />
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
