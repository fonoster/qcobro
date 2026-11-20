import { useState, useEffect } from "react";
import { Bot, PhoneOutgoing } from "lucide-react";
import {
  normalizeForGsm7,
  renderTemplate,
  renderWhatsAppTemplate,
  buildOutreachContext,
  type PortfolioAccountRecord
} from "@qcobro/common";
import { trpc } from "../../lib/trpc.js";
import { useWorkspaceLocale } from "../../lib/useWorkspaceCurrency.js";
import { useI18n } from "../../lib/i18n.js";
import { Dialog } from "../ui/dialog.js";
import { SelectGroup } from "../ui/select.js";
import { InputGroup } from "../ui/input.js";
import { Textarea } from "../ui/textarea.js";
import { FieldLabel } from "../ui/field.js";
import { InfoNote } from "./InfoNote.js";

/** The first message / script / body preview: editable, styled as the design's muted box. */
function PreviewBox({
  id,
  label,
  value,
  rows,
  readOnly,
  placeholder,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  rows: number;
  readOnly?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="resize-none border-transparent bg-elevated px-3.5 py-3"
      />
    </div>
  );
}

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
  const locale = useWorkspaceLocale();
  const [agentTemplateId, setAgentTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  // "Selecciona un agente." / no phone / no email: shown under the agent select.
  const [agentError, setAgentError] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editFirstMessage, setEditFirstMessage] = useState("");

  const agentsQuery = trpc.agentTemplates.list.useQuery();
  const agents = (agentsQuery.data ?? []).filter(
    (a) => !(a as { archivedAt?: string | null }).archivedAt
  ) as Array<{ id: string; name: string; type: string }>;

  const selected = agents.find((a) => a.id === agentTemplateId);
  const agentType = selected?.type;

  const templateQuery = trpc.agentTemplates.get.useQuery(
    { id: agentTemplateId },
    { enabled: !!agentTemplateId }
  );

  const tmpl = templateQuery.data as Record<string, unknown> | undefined;

  // Reset editable fields when the agent changes.
  useEffect(() => {
    setEditSubject("");
    setEditBody("");
    setEditFirstMessage("");
  }, [agentTemplateId]);

  // Populate editable fields with rendered template values once loaded.
  useEffect(() => {
    if (!tmpl || !agentType) return;
    const ctx = buildOutreachContext(account as unknown as PortfolioAccountRecord, {
      ...portfolio,
      locale
    });

    if (agentType === "EMAIL") {
      const ec = tmpl.emailConfig as { subject?: string; messageBody?: string } | undefined;
      setEditSubject(ec?.subject ? renderTemplate(ec.subject, ctx) : "");
      setEditBody(ec?.messageBody ? renderTemplate(ec.messageBody, ctx) : "");
    } else if (agentType === "SMS") {
      const sc = tmpl.smsConfig as { messageBody?: string; normalizeGsm7?: boolean } | undefined;
      // Apply the template's GSM-7 substitution here too, or the preview shows text that
      // differs from what the customer will actually receive.
      const body = sc?.messageBody ? renderTemplate(sc.messageBody, ctx) : "";
      setEditBody(sc?.normalizeGsm7 ? normalizeForGsm7(body) : body);
    } else if (agentType === "VOICE_AI") {
      const vc = tmpl.voiceAiConfig as { firstMessage?: string | null } | undefined;
      setEditFirstMessage(vc?.firstMessage ? renderTemplate(vc.firstMessage, ctx) : "");
    } else if (agentType === "VOICE_PRERECORDED") {
      const vc = tmpl.voicePrerecordedConfig as { script?: string } | undefined;
      setEditFirstMessage(vc?.script ? renderTemplate(vc.script, ctx) : "");
    } else if (agentType === "WHATSAPP") {
      const wc = tmpl.whatsAppConfig as { messageBody?: string } | undefined;
      setEditBody(wc?.messageBody ? renderWhatsAppTemplate(wc.messageBody, ctx).renderedBody : "");
    }
  }, [tmpl, agentType, locale]);

  const dispatch = trpc.outreach.dispatch.useMutation({
    onSuccess,
    onError: (err) => setError(err.message)
  });

  function channelLabel(type?: string): string {
    return type ? t(`agents.type.${type}` as Parameters<typeof t>[0]) : "";
  }

  // "Voz IA · llamada saliente a +1 809 …", "SMS · mensaje a …", "Correo · correo a …".
  function destination(type: string): string | null {
    const to = type === "EMAIL" ? account.email : account.phone;
    if (!to) return null;
    const kind = type === "EMAIL" ? "email" : type.startsWith("VOICE") ? "call" : "message";
    return `${channelLabel(type)} · ${t(`portfolios.reachOut.to.${kind}`).replace("{to}", to)}`;
  }

  function handleConfirm() {
    if (!agentTemplateId) return setAgentError(t("portfolios.reachOut.noAgent"));
    if (agentType === "EMAIL" && !account.email)
      return setAgentError(t("portfolios.reachOut.noEmail"));
    if (agentType !== "EMAIL" && !account.phone)
      return setAgentError(t("portfolios.reachOut.noPhone"));
    setAgentError(null);
    setError(null);
    dispatch.mutate({
      portfolioAccountId: account.id,
      agentTemplateId,
      subject: agentType === "EMAIL" ? editSubject : undefined,
      body: agentType === "EMAIL" || agentType === "SMS" ? editBody : undefined,
      firstMessage: agentType === "VOICE_AI" ? editFirstMessage || undefined : undefined,
      script: agentType === "VOICE_PRERECORDED" ? editFirstMessage || undefined : undefined
    });
  }

  const isLoading = !!selected && templateQuery.isLoading;
  const subtitle = [account.fullName, account.externalId as string | undefined]
    .filter(Boolean)
    .join(" · ");
  const to = agentType ? destination(agentType) : null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("portfolios.reachOut.title")}
      subtitle={subtitle || t("portfolios.reachOut.subtitle")}
      confirmLabel={
        dispatch.isPending ? t("portfolios.bulk.sending") : t("portfolios.reachOut.send")
      }
      confirmIcon={<PhoneOutgoing className="h-4 w-4" />}
      confirmDisabled={dispatch.isPending}
      onConfirm={handleConfirm}
      error={error}
    >
      <div className="flex flex-col gap-[18px]">
        <SelectGroup
          label={t("portfolios.reachOut.agent")}
          id="reach-agent"
          icon={<Bot />}
          value={agentTemplateId}
          error={agentError ?? undefined}
          onChange={(e) => {
            setAgentTemplateId(e.target.value);
            // The "Selecciona un agente" error is stale once an agent is chosen.
            setAgentError(null);
            setError(null);
          }}
        >
          <option value="">{t("portfolios.reachOut.agentPlaceholder")}</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectGroup>

        {!isLoading && agentType === "EMAIL" && (
          <>
            <InputGroup
              id="reach-subject"
              label={t("portfolios.reachOut.preview.subject")}
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
            />
            <PreviewBox
              id="reach-body"
              label={t("portfolios.reachOut.preview.body")}
              value={editBody}
              rows={5}
              onChange={setEditBody}
            />
          </>
        )}

        {!isLoading && agentType === "SMS" && (
          <PreviewBox
            id="reach-sms-body"
            label={t("portfolios.reachOut.preview.SMS")}
            value={editBody}
            rows={3}
            onChange={setEditBody}
          />
        )}

        {!isLoading && agentType === "VOICE_PRERECORDED" && (
          <PreviewBox
            id="reach-script"
            label={t("portfolios.reachOut.preview.VOICE_PRERECORDED")}
            value={editFirstMessage}
            rows={4}
            onChange={setEditFirstMessage}
          />
        )}

        {!isLoading && agentType === "VOICE_AI" && (
          <PreviewBox
            id="reach-first-message"
            label={t("portfolios.reachOut.preview.VOICE_AI")}
            value={editFirstMessage}
            rows={3}
            placeholder={t("portfolios.reachOut.firstMessageNotSet")}
            onChange={setEditFirstMessage}
          />
        )}

        {!isLoading && agentType === "WHATSAPP" && (
          <>
            <PreviewBox
              id="reach-whatsapp-body"
              label={t("portfolios.reachOut.preview.WHATSAPP")}
              value={editBody}
              rows={3}
              readOnly
            />
            <p className="-mt-2.5 text-xs text-fg-muted">
              {t("portfolios.reachOut.whatsAppReadOnly")}
            </p>
          </>
        )}

        {!isLoading && to && <p className="-mt-2.5 text-xs text-fg-muted">{to}</p>}

        <InfoNote>{t("portfolios.reachOut.footnote")}</InfoNote>
      </div>
    </Dialog>
  );
}
