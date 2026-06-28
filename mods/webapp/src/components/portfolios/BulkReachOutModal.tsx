import { useState } from "react";
import { Bot } from "lucide-react";
import { trpc } from "../../lib/trpc.js";
import { useI18n } from "../../lib/i18n.js";
import { Dialog } from "../ui/dialog.js";
import { SelectGroup } from "../ui/select.js";

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
  const [sending, setSending] = useState(false);

  const agentsQuery = trpc.agentTemplates.list.useQuery();
  const agents = (agentsQuery.data ?? []).filter(
    (a) => !(a as { archivedAt?: string | null }).archivedAt
  ) as Array<{ id: string; name: string; type: string }>;

  const selected = agents.find((a) => a.id === agentTemplateId);
  const dispatch = trpc.outreach.dispatch.useMutation();

  async function handleConfirm() {
    if (!agentTemplateId) return setError(t("portfolios.reachOut.noAgent"));
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
      description={t("portfolios.bulk.subtitle")}
      confirmLabel={
        sending
          ? t("portfolios.bulk.sending")
          : t("portfolios.bulk.send").replace("{count}", String(count))
      }
      onConfirm={handleConfirm}
    >
      <div className="mt-4 flex flex-col gap-3">
        <SelectGroup
          label={t("portfolios.reachOut.agent")}
          id="bulk-agent"
          value={agentTemplateId}
          onChange={(e) => setAgentTemplateId(e.target.value)}
        >
          <option value="">{t("portfolios.reachOut.agentPlaceholder")}</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectGroup>

        {selected && (
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-100 px-3 py-2.5">
            <Bot className="h-4 w-4 shrink-0 text-slate-600" />
            <span className="text-sm text-slate-700">{selected.name}</span>
          </div>
        )}

        <p className="text-xs text-slate-400">{t("portfolios.reachOut.footnote")}</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
