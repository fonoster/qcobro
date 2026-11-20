import { useMemo, useState } from "react";
import { Handshake, Send } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { useMoney, useWorkspaceTimezone } from "../lib/useWorkspaceCurrency.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable, TableCellStack } from "../components/ui/data-table.js";
import { FilterChip } from "../components/ui/filter-chip.js";
import { SearchBox } from "../components/ui/input.js";
import { SelectGroup } from "../components/ui/select.js";
import { Button } from "../components/ui/button.js";
import { Dialog } from "../components/ui/dialog.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { KpiRow } from "../components/kpi-card.js";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";
import { ChannelLabel } from "./Gestiones.js";
import { formatDay, resolveTimeZone } from "./gestionFormat.js";

type Status = "PENDING" | "MET" | "EXPIRED" | "CANCELLED";
/** DUE is derived, never stored: a PENDING promise whose dueDate has passed. */
type ShownStatus = Status | "DUE";

type PaymentPromise = {
  id: string;
  amount: number | null;
  dueDate: string;
  status: Status;
  updatedAt?: string;
  portfolioAccount?: { fullName: string; externalId?: string } | null;
  contactLog?: { agentType: string } | null;
};

type Key = Parameters<ReturnType<typeof useI18n>["t"]>[0];

const DAY = 1000 * 60 * 60 * 24;
const CHANNELS = ["VOICE_AI", "VOICE_PRERECORDED", "SMS", "EMAIL", "WHATSAPP"];
const STATUSES: ShownStatus[] = ["PENDING", "DUE", "MET", "EXPIRED", "CANCELLED"];

function daysUntil(due: string): number {
  return Math.ceil((new Date(due).getTime() - Date.now()) / DAY);
}

function isDue(p: { status: string; dueDate: string }): boolean {
  return p.status === "PENDING" && new Date(p.dueDate).getTime() < Date.now();
}

const shownStatus = (p: PaymentPromise): ShownStatus => (isDue(p) ? "DUE" : p.status);

export function PaymentPromises() {
  const { t, language } = useI18n();
  const money = useMoney();
  const timeZone = resolveTimeZone(useWorkspaceTimezone());
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ShownStatus>("");
  const [originFilter, setOriginFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const { data, isLoading } = trpc.campaigns.paymentPromise.list.useQuery(undefined);
  const all: PaymentPromise[] = (data ?? []) as PaymentPromise[];
  const templates = trpc.agentTemplates.list.useQuery();

  const invalidate = () => utils.campaigns.paymentPromise.list.invalidate();
  const resolve = trpc.campaigns.paymentPromise.resolve.useMutation({ onSuccess: invalidate });
  const followUp = trpc.campaigns.paymentPromise.followUp.useMutation({ onSuccess: invalidate });

  const pending = all.filter((p) => p.status === "PENDING");
  const pendingAmount = pending.reduce((s, p) => s + (p.amount ?? 0), 0);
  const dueThisWeek = pending.filter((p) => {
    const d = daysUntil(p.dueDate);
    return d >= 0 && d <= 7;
  }).length;
  // Fulfillment over the promises that fell due in the last 30 days, excluding
  // EXPIRED/CANCELLED: kept / (kept + overdue-unresolved).
  const recent = all.filter((p) => {
    const d = daysUntil(p.dueDate);
    return d <= 0 && d > -30;
  });
  const met = recent.filter((p) => p.status === "MET").length;
  const denom = met + recent.filter(isDue).length;
  const fulfillment = denom > 0 ? Math.round((met / denom) * 100) : 0;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((p) => {
      if (statusFilter && shownStatus(p) !== statusFilter) return false;
      if (originFilter && p.contactLog?.agentType !== originFilter) return false;
      if (!q) return true;
      return [p.portfolioAccount?.fullName, p.portfolioAccount?.externalId].some((v) =>
        (v ?? "").toLowerCase().includes(q)
      );
    });
  }, [all, search, statusFilter, originFilter]);

  const followUpItems = (id: string) =>
    (templates.data ?? []).map((tpl: { id: string; name: string }) => ({
      label: `${t("paymentPromises.actions.followUpWith")} ${tpl.name}`,
      onClick: () => followUp.mutate({ paymentPromiseId: id, agentTemplateId: tpl.id })
    }));

  const closeFollowUp = () => {
    setFollowUpOpen(false);
    setFollowUpError(null);
  };

  // One follow-up per selected promise, through the same procedure the row menu uses.
  const sendFollowUps = async () => {
    if (!templateId) return;
    setSending(true);
    const results = await Promise.allSettled(
      selected.map((id) =>
        followUp.mutateAsync({ paymentPromiseId: id, agentTemplateId: templateId })
      )
    );
    setSending(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      setFollowUpError(
        t("paymentPromises.followUpDialog.error")
          .replace("{failed}", String(failed))
          .replace("{count}", String(selected.length))
      );
      return;
    }
    closeFollowUp();
    setSelected([]);
  };

  const allLabel = t("paymentPromises.filter.all");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("paymentPromises.title")}
        description={t("paymentPromises.description")}
      />

      <KpiRow
        cards={[
          { label: t("paymentPromises.kpi.pending"), value: pending.length.toLocaleString() },
          { label: t("paymentPromises.kpi.pendingAmount"), value: money(pendingAmount) },
          { label: t("paymentPromises.kpi.dueThisWeek"), value: dueThisWeek.toLocaleString() },
          {
            label: t("paymentPromises.kpi.fulfillment"),
            value: `${fulfillment}%`,
            subtext: t("paymentPromises.kpi.last30"),
            notesUnderValue: true
          }
        ]}
      />

      <DataTable
        data={rows as unknown as Record<string, unknown>[]}
        keyField="id"
        searchable={false}
        filterElement={
          <SearchBox
            placeholder={t("paymentPromises.searchPlaceholder")}
            aria-label={t("paymentPromises.searchPlaceholder")}
            className="w-[280px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        }
        filters={
          <>
            <FilterChip
              label={t("paymentPromises.filter.status")}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "" | ShownStatus)}
              options={[
                { value: "", label: allLabel },
                ...STATUSES.map((s) => ({
                  value: s,
                  label: t(`paymentPromises.status.${s}` as Key)
                }))
              ]}
            />
            <FilterChip
              label={t("paymentPromises.filter.origin")}
              value={originFilter}
              onChange={setOriginFilter}
              options={[
                { value: "", label: allLabel },
                ...CHANNELS.map((c) => ({ value: c, label: t(`gestiones.channel.${c}` as Key) }))
              ]}
            />
          </>
        }
        countLabel={t("paymentPromises.count")}
        selectable
        selectionBar="none"
        getRowId={(r) => r.id as string}
        selectedIds={selected}
        onSelectionChange={setSelected}
        empty={
          isLoading ? undefined : (
            <EmptyState
              icon={<Handshake />}
              title={t("paymentPromises.empty")}
              body={t("paymentPromises.emptyBody")}
            />
          )
        }
        columns={[
          {
            key: "portfolioAccount",
            header: t("paymentPromises.col.account"),
            render: (r) => {
              const acc = r.portfolioAccount as PaymentPromise["portfolioAccount"];
              return <TableCellStack title={acc?.fullName ?? "—"} sub={acc?.externalId} />;
            }
          },
          {
            key: "status",
            header: t("paymentPromises.col.status"),
            width: 140,
            render: (r) => t(`paymentPromises.status.${shownStatus(r as PaymentPromise)}` as Key)
          },
          {
            key: "dueDate",
            header: t("paymentPromises.col.due"),
            width: 140,
            mono: true,
            render: (r) => formatDay(r.dueDate as string, language, timeZone)
          },
          {
            key: "channel",
            header: t("paymentPromises.col.origin"),
            width: 140,
            render: (r) => {
              const ch = (r.contactLog as { agentType: string } | undefined)?.agentType;
              return ch ? <ChannelLabel channel={ch} /> : <span className="text-fg-muted">—</span>;
            }
          },
          {
            key: "amount",
            header: t("paymentPromises.col.amount"),
            width: 120,
            mono: true,
            render: (r) => (r.amount != null ? money(r.amount as number) : "—")
          },
          {
            key: "id",
            header: "",
            align: "right",
            width: 24,
            className: "whitespace-nowrap",
            render: (r) =>
              r.status === "PENDING" ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <RowActionsMenu
                    items={[
                      // No "Marcar pagada": a promise is kept when the sync shows the account
                      // left the portfolio caught up or paid off.
                      ...followUpItems(r.id as string),
                      {
                        label: t("paymentPromises.actions.markCancelled"),
                        onClick: () => resolve.mutate({ id: r.id as string, status: "CANCELLED" }),
                        variant: "destructive"
                      }
                    ]}
                  />
                </div>
              ) : null
          }
        ]}
      />

      {selected.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
          <span className="text-[13px] text-fg">
            {t("paymentPromises.selected").replace("{count}", String(selected.length))}
          </span>
          <div className="flex items-center gap-2.5">
            <Button type="button" variant="ghost" onClick={() => setSelected([])}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={() => setFollowUpOpen(true)}>
              <Send className="h-4 w-4" />
              {t("paymentPromises.followUp")}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={followUpOpen}
        onClose={closeFollowUp}
        title={t("paymentPromises.followUp")}
        subtitle={t("paymentPromises.followUpDialog.subtitle")}
        confirmLabel={t("paymentPromises.followUp")}
        confirmIcon={<Send className="h-4 w-4" />}
        confirmDisabled={!templateId || sending}
        onConfirm={() => void sendFollowUps()}
        error={followUpError}
      >
        <SelectGroup
          id="follow-up-agent"
          label={t("paymentPromises.followUpDialog.agent")}
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">{t("paymentPromises.followUpDialog.placeholder")}</option>
          {(templates.data ?? []).map((tpl: { id: string; name: string }) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </SelectGroup>
      </Dialog>
    </div>
  );
}
