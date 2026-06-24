import { useState } from "react";
import { Bot } from "lucide-react";
import { trpc } from "../../lib/trpc.js";
import { useI18n } from "../../lib/i18n.js";
import { Dialog } from "../ui/dialog.js";
import { SelectGroup } from "../ui/select.js";

/**
 * Bulk variant of {@link ReachOutModal}: pick one campaign and dispatch it to every
 * selected account. Reuses the same `outreach.dispatch` mutation per account — no new
 * backend endpoint — so the bulk flow stays consistent with the single-account flow.
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
  const [campaignId, setCampaignId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const campaignsQuery = trpc.campaigns.list.useQuery();
  const campaigns = (campaignsQuery.data ?? []).filter(
    (c) => (c as { status?: string }).status !== "ARCHIVED"
  ) as Array<{ id: string; name: string; agentTemplate?: { name: string; type: string } | null }>;

  const selected = campaigns.find((c) => c.id === campaignId);
  const dispatch = trpc.outreach.dispatch.useMutation();

  async function handleConfirm() {
    if (!campaignId) return setError(t("portfolios.reachOut.noCampaign"));
    setError(null);
    setSending(true);
    try {
      for (const id of accountIds) {
        await dispatch.mutateAsync({ portfolioAccountId: id, campaignId });
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
          label={t("portfolios.reachOut.campaign")}
          id="bulk-campaign"
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
              {t("portfolios.reachOut.willUse")} {selected.agentTemplate.name}
            </span>
          </div>
        )}

        <p className="text-xs text-slate-400">{t("portfolios.reachOut.footnote")}</p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
