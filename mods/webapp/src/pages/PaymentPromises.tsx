import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { useWorkspaceCurrency } from "../lib/useWorkspaceCurrency.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable } from "../components/ui/data-table.js";
import { FilterSelect } from "../components/ui/select.js";
import { Badge } from "../components/ui/badge.js";
import { KpiRow } from "../components/kpi-card.js";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";

type Status = "PENDING" | "MET" | "EXPIRED" | "CANCELLED";

type PaymentPromise = {
  id: string;
  amount: number | null;
  dueDate: string;
  status: Status;
  portfolioAccount?: { fullName: string } | null;
  contactLog?: { agentType: string } | null;
};

function money(v: number, currency: string) {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency,
    minimumFractionDigits: 0
  }).format(v);
}

function statusVariant(s: string) {
  if (s === "MET") return "success";
  if (s === "EXPIRED") return "secondary";
  if (s === "CANCELLED") return "secondary";
  return "orange";
}

function daysUntil(due: string): number {
  const ms = new Date(due).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** DUE is derived, never stored: a PENDING promise whose dueDate has passed. */
function isDue(p: { status: string; dueDate: string }): boolean {
  return p.status === "PENDING" && new Date(p.dueDate).getTime() < Date.now();
}

export function PaymentPromises() {
  const { t } = useI18n();
  const wsCurrency = useWorkspaceCurrency();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<"" | Status>("");

  const { data } = trpc.campaigns.paymentPromise.list.useQuery(undefined);
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
  // Fulfillment excludes EXPIRED/CANCELLED: kept / (kept + overdue-unresolved).
  const met = all.filter((p) => p.status === "MET").length;
  const overdueUnresolved = all.filter(isDue).length;
  const denom = met + overdueUnresolved;
  const fulfillment = denom > 0 ? Math.round((met / denom) * 100) : 0;

  const rows = statusFilter ? all.filter((p) => p.status === statusFilter) : all;

  const followUpItems = (id: string) =>
    (templates.data ?? []).map((tpl: { id: string; name: string }) => ({
      label: `${t("paymentPromises.actions.followUpWith")} ${tpl.name}`,
      onClick: () => followUp.mutate({ paymentPromiseId: id, agentTemplateId: tpl.id })
    }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("paymentPromises.title")}
        description={t("paymentPromises.description")}
      />

      <KpiRow
        cards={[
          { label: t("paymentPromises.kpi.pending"), value: pending.length.toLocaleString() },
          {
            label: t("paymentPromises.kpi.pendingAmount"),
            value: money(pendingAmount, wsCurrency)
          },
          { label: t("paymentPromises.kpi.dueThisWeek"), value: dueThisWeek.toLocaleString() },
          { label: t("paymentPromises.kpi.fulfillment"), value: `${fulfillment}%` }
        ]}
      />

      <DataTable
        data={rows as unknown as Record<string, unknown>[]}
        keyField="id"
        searchable={false}
        filterElement={
          <FilterSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | Status)}
          >
            <option value="">{t("paymentPromises.filter.allStatuses")}</option>
            {(["PENDING", "MET", "EXPIRED", "CANCELLED"] as Status[]).map((s) => (
              <option key={s} value={s}>
                {t(`paymentPromises.status.${s}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </FilterSelect>
        }
        columns={[
          {
            key: "portfolioAccount",
            header: t("paymentPromises.col.account"),
            render: (r) => (r.portfolioAccount as { fullName: string } | undefined)?.fullName ?? "—"
          },
          {
            key: "channel",
            header: t("paymentPromises.col.channel"),
            render: (r) => {
              const ch = (r.contactLog as { agentType: string } | undefined)?.agentType;
              return ch ? (
                <span className="text-sm text-slate-600">
                  {t(`gestiones.agentType.${ch}` as Parameters<typeof t>[0])}
                </span>
              ) : (
                "—"
              );
            }
          },
          {
            key: "amount",
            header: t("paymentPromises.col.amount"),
            render: (r) => (r.amount != null ? money(r.amount as number, wsCurrency) : "—")
          },
          {
            key: "dueDate",
            header: t("paymentPromises.col.dueDate"),
            render: (r) => new Date(r.dueDate as string).toLocaleDateString()
          },
          {
            key: "status",
            header: t("paymentPromises.col.status"),
            render: (r) =>
              isDue(r as { status: string; dueDate: string }) ? (
                <Badge variant="destructive">{t("paymentPromises.status.DUE")}</Badge>
              ) : (
                <Badge variant={statusVariant(r.status as string)}>
                  {t(`paymentPromises.status.${r.status}` as Parameters<typeof t>[0])}
                </Badge>
              )
          },
          {
            key: "id",
            header: "",
            align: "center",
            render: (r) =>
              r.status === "PENDING" ? (
                <RowActionsMenu
                  items={[
                    {
                      label: t("paymentPromises.actions.markPaid"),
                      onClick: () => resolve.mutate({ id: r.id as string, status: "MET" })
                    },
                    ...followUpItems(r.id as string),
                    {
                      label: t("paymentPromises.actions.markCancelled"),
                      onClick: () => resolve.mutate({ id: r.id as string, status: "CANCELLED" }),
                      variant: "destructive"
                    }
                  ]}
                />
              ) : null
          }
        ]}
      />
    </div>
  );
}
