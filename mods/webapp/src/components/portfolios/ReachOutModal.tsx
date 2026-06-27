import { useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { renderTemplate, buildOutreachContext, type PortfolioAccountRecord } from "@qcobro/common";
import { trpc } from "../../lib/trpc.js";
import { useI18n } from "../../lib/i18n.js";
import { Dialog } from "../ui/dialog.js";
import { SelectGroup } from "../ui/select.js";
import { InputGroup } from "../ui/input.js";
import { TextareaGroup } from "../ui/textarea.js";

type Account = Record<string, unknown> & {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
};

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
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editFirstMessage, setEditFirstMessage] = useState("");

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

  const tmpl = templateQuery.data as Record<string, unknown> | undefined;

  // Reset editable fields when campaign changes.
  useEffect(() => {
    setEditSubject("");
    setEditBody("");
    setEditFirstMessage("");
  }, [campaignId]);

  // Populate editable fields with rendered template values once loaded.
  useEffect(() => {
    if (!tmpl || !agentType) return;
    const ctx = buildOutreachContext(account as unknown as PortfolioAccountRecord, portfolio);

    if (agentType === "EMAIL") {
      const ec = tmpl.emailConfig as { subject?: string; messageBody?: string } | undefined;
      setEditSubject(ec?.subject ? renderTemplate(ec.subject, ctx) : "");
      setEditBody(ec?.messageBody ? renderTemplate(ec.messageBody, ctx) : "");
    } else if (agentType === "SMS") {
      const sc = tmpl.smsConfig as { messageBody?: string } | undefined;
      setEditBody(sc?.messageBody ? renderTemplate(sc.messageBody, ctx) : "");
    } else if (agentType === "VOICE_AI") {
      const vc = tmpl.voiceAiConfig as { firstMessage?: string | null } | undefined;
      setEditFirstMessage(vc?.firstMessage ? renderTemplate(vc.firstMessage, ctx) : "");
    } else if (agentType === "VOICE_PRERECORDED") {
      const vc = tmpl.voicePrerecordedConfig as { script?: string } | undefined;
      setEditFirstMessage(vc?.script ? renderTemplate(vc.script, ctx) : "");
    }
  }, [tmpl, agentType]);

  const dispatch = trpc.outreach.dispatch.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function channelLabel(type?: string): string {
    return type ? t(`agents.type.${type}` as Parameters<typeof t>[0]) : "";
  }

  function handleConfirm() {
    if (!campaignId) return setError(t("portfolios.reachOut.noCampaign"));
    if (agentType === "EMAIL" && !account.email) return setError(t("portfolios.reachOut.noEmail"));
    if (agentType !== "EMAIL" && !account.phone) return setError(t("portfolios.reachOut.noPhone"));
    setError(null);
    dispatch.mutate({
      portfolioAccountId: account.id,
      campaignId,
      subject: agentType === "EMAIL" ? editSubject : undefined,
      body: agentType === "EMAIL" || agentType === "SMS" ? editBody : undefined,
      firstMessage:
        agentType === "VOICE_AI" || agentType === "VOICE_PRERECORDED"
          ? editFirstMessage || undefined
          : undefined
    });
  }

  const isLoading = !!selected && templateQuery.isLoading;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("portfolios.reachOut.title")}
      description={t("portfolios.reachOut.subtitle")}
      confirmLabel={dispatch.isPending ? "…" : t("portfolios.reachOut.send")}
      onConfirm={handleConfirm}
    >
      <div className="mt-4 flex flex-col gap-4">
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

        {!isLoading && agentType === "EMAIL" && (
          <>
            <InputGroup
              id="reach-subject"
              label={t("portfolios.reachOut.preview.subject")}
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
            />
            <TextareaGroup
              id="reach-body"
              label={t("portfolios.reachOut.preview.body")}
              value={editBody}
              rows={5}
              onChange={(e) => setEditBody(e.target.value)}
            />
          </>
        )}

        {!isLoading && agentType === "SMS" && (
          <TextareaGroup
            id="reach-sms-body"
            label={t("portfolios.reachOut.preview.SMS")}
            value={editBody}
            rows={3}
            onChange={(e) => setEditBody(e.target.value)}
          />
        )}

        {!isLoading && agentType === "VOICE_PRERECORDED" && (
          <TextareaGroup
            id="reach-script"
            label={t("portfolios.reachOut.preview.VOICE_PRERECORDED")}
            value={editFirstMessage}
            rows={4}
            onChange={(e) => setEditFirstMessage(e.target.value)}
          />
        )}

        {!isLoading && agentType === "VOICE_AI" && (
          <TextareaGroup
            id="reach-first-message"
            label={t("portfolios.reachOut.preview.VOICE_AI")}
            value={editFirstMessage}
            rows={3}
            placeholder={t("portfolios.reachOut.firstMessageNotSet")}
            onChange={(e) => setEditFirstMessage(e.target.value)}
          />
        )}

        <p className="text-xs text-slate-400">{t("portfolios.reachOut.footnote")}</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
