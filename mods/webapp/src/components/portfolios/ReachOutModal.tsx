import { useState } from "react";
import { Bot } from "lucide-react";
import { renderTemplate, buildOutreachContext, type PortfolioAccountRecord } from "@qcobro/common";
import { trpc } from "../../lib/trpc.js";
import { useI18n } from "../../lib/i18n.js";
import { Dialog } from "../ui/dialog.js";
import { SelectGroup } from "../ui/select.js";

type Account = Record<string, unknown> & { id: string; fullName: string; phone?: string | null };

const PREVIEW_TYPES = ["VOICE_AI", "VOICE_PRERECORDED", "SMS"] as const;
type PreviewType = (typeof PREVIEW_TYPES)[number];

function bodyFor(type: string, cfg: Record<string, unknown> | undefined): string | null {
  if (!cfg) return null;
  if (type === "VOICE_AI")
    return (cfg.voiceAiConfig as { firstMessage?: string })?.firstMessage ?? null;
  if (type === "VOICE_PRERECORDED")
    return (cfg.voicePrerecordedConfig as { script?: string })?.script ?? null;
  if (type === "SMS") return (cfg.smsConfig as { messageBody?: string })?.messageBody ?? null;
  return null;
}

export function ReachOutModal({
  account,
  portfolio,
  onClose,
  onSuccess
}: {
  account: Account;
  portfolio: { currency: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [campaignId, setCampaignId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const campaignsQuery = trpc.campaigns.list.useQuery();
  const campaigns = (campaignsQuery.data ?? []).filter(
    (c) => (c as { status?: string }).status !== "ARCHIVED"
  ) as Array<{
    id: string;
    name: string;
    agentTemplateId: string;
    agentTemplate?: { name: string; type: string } | null;
  }>;

  const selected = campaigns.find((c) => c.id === campaignId);
  const agentType = selected?.agentTemplate?.type;

  const templateQuery = trpc.agentTemplates.get.useQuery(
    { id: selected?.agentTemplateId ?? "" },
    { enabled: !!selected }
  );

  const dispatch = trpc.outreach.dispatch.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function channelLabel(type?: string): string {
    return type ? t(`agents.type.${type}` as Parameters<typeof t>[0]) : "";
  }

  let preview: { label: string; body: string } | null = null;
  if (selected && agentType && (PREVIEW_TYPES as readonly string[]).includes(agentType)) {
    const raw = bodyFor(agentType, templateQuery.data as Record<string, unknown> | undefined);
    if (raw) {
      const ctx = buildOutreachContext(account as unknown as PortfolioAccountRecord, portfolio);
      preview = {
        label: t(
          `portfolios.reachOut.preview.${agentType as PreviewType}` as Parameters<typeof t>[0]
        ),
        body: renderTemplate(raw, ctx)
      };
    }
  }

  function handleConfirm() {
    if (!account.phone) return setError(t("portfolios.reachOut.noPhone"));
    if (!campaignId) return setError(t("portfolios.reachOut.noCampaign"));
    setError(null);
    dispatch.mutate({ portfolioAccountId: account.id, campaignId });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("portfolios.reachOut.title")}
      description={t("portfolios.reachOut.subtitle")}
      confirmLabel={dispatch.isPending ? "…" : t("portfolios.reachOut.send")}
      onConfirm={handleConfirm}
    >
      <div className="mt-4 flex flex-col gap-3">
        <SelectGroup
          label={t("portfolios.reachOut.campaign")}
          id="reach-campaign"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        >
          <option value="">{t("portfolios.reachOut.campaignPlaceholder")}</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectGroup>

        {selected?.agentTemplate && (
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-100 px-3 py-2.5">
            <Bot className="h-4 w-4 shrink-0 text-slate-600" />
            <span className="text-sm text-slate-700">
              {t("portfolios.reachOut.willUse")} {selected.agentTemplate.name}{" "}
              {t("portfolios.reachOut.via")} {channelLabel(agentType)}
            </span>
          </div>
        )}

        {preview && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500">{preview.label}</span>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-700">
              {preview.body}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400">{t("portfolios.reachOut.footnote")}</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
