import { useState } from "react";
import { Bot } from "lucide-react";
import { trpc } from "../../lib/trpc.js";
import { useI18n } from "../../lib/i18n.js";
import { Dialog } from "../ui/dialog.js";
import { SelectGroup } from "../ui/select.js";
import { InfoNote } from "./InfoNote.js";

/**
 * Bulk variant of {@link ReachOutModal}: pick one agent template and dispatch it ad-hoc to
 * every selected account (no campaign). Reuses the same `outreach.dispatch` mutation per
 * account — no new backend endpoint — so the bulk flow stays consistent with the
 * single-account flow.
 */
export function BulkReachOutModal({
  accountIds,
  onClose,
  onSuccess
}: {
  accountIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [agentTemplateId, setAgentTemplateId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const agentsQuery = trpc.agentTemplates.list.useQuery();
  const agents = (agentsQuery.data ?? []).filter(
    (a) => !(a as { archivedAt?: string | null }).archivedAt
  ) as Array<{ id: string; name: string; type: string }>;

  const dispatch = trpc.outreach.dispatch.useMutation();

  async function handleConfirm() {
    if (!agentTemplateId) return setAgentError(t("portfolios.reachOut.noAgent"));
    setAgentError(null);
    setError(null);
    setSending(true);
    try {
      for (const id of accountIds) {
        await dispatch.mutateAsync({ portfolioAccountId: id, agentTemplateId });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  const count = accountIds.length;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("portfolios.bulk.title").replace("{count}", String(count))}
      subtitle={t("portfolios.bulk.subtitle")}
      confirmLabel={
        sending
          ? t("portfolios.bulk.sending")
          : t("portfolios.bulk.send").replace("{count}", String(count))
      }
      confirmDisabled={sending}
      onConfirm={handleConfirm}
      error={error}
    >
      <div className="flex flex-col gap-[18px]">
        <SelectGroup
          label={t("portfolios.reachOut.agent")}
          id="bulk-agent"
          icon={<Bot />}
          value={agentTemplateId}
          error={agentError ?? undefined}
          onChange={(e) => {
            setAgentTemplateId(e.target.value);
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

        <InfoNote>{t("portfolios.reachOut.footnote")}</InfoNote>
      </div>
    </Dialog>
  );
}
