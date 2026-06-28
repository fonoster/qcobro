import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { useI18n } from "../lib/i18n.js";
import { PageHeader } from "../components/page-header.js";
import { DataTable } from "../components/ui/data-table.js";
import { FilterSelect } from "../components/ui/select.js";
import { Badge } from "../components/ui/badge.js";
import { KpiRow } from "../components/kpi-card.js";
import { RowActionsMenu } from "../components/ui/row-actions-menu.js";

type Status = "PENDING" | "MET" | "BROKEN" | "CANCELLED";

type Objective = {
  id: string;
  type: string;
  amount: number | null;
  dueDate: string;
  status: Status;
  portfolioAccount?: { fullName: string } | null;
};

function money(v: number) {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0
  }).format(v);
}

function statusVariant(s: string) {
  if (s === "MET") return "success";
  if (s === "BROKEN") return "destructive";
  if (s === "CANCELLED") return "secondary";
  return "orange";
}

function daysUntil(due: string): number {
  const ms = new Date(due).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function Objetivos() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<"" | Status>("");

  const { data } = trpc.campaigns.objective.list.useQuery(undefined);
  const all: Objective[] = (data ?? []) as Objective[];

  const update = trpc.campaigns.objective.updateStatus.useMutation({
    onSuccess: () => utils.campaigns.objective.list.invalidate()
  });

  const pending = all.filter((o) => o.status === "PENDING");
  const pendingAmount = pending.reduce((s, o) => s + (o.amount ?? 0), 0);
  const dueThisWeek = pending.filter((o) => {
    const d = daysUntil(o.dueDate);
    return d >= 0 && d <= 7;
  }).length;
  const closed = all.filter((o) => o.status !== "PENDING");
  const met = closed.filter((o) => o.status === "MET").length;
  const fulfillment = closed.length > 0 ? Math.round((met / closed.length) * 100) : 0;

  const rows = statusFilter ? all.filter((o) => o.status === statusFilter) : all;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("objetivos.title")} description={t("objetivos.description")} />

      <KpiRow
        cards={[
          { label: t("objetivos.kpi.pending"), value: pending.length.toLocaleString() },
          { label: t("objetivos.kpi.pendingAmount"), value: money(pendingAmount) },
          { label: t("objetivos.kpi.dueThisWeek"), value: dueThisWeek.toLocaleString() },
          { label: t("objetivos.kpi.fulfillment"), value: `${fulfillment}%` }
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
            <option value="">{t("objetivos.filter.allStatuses")}</option>
            {(["PENDING", "MET", "BROKEN", "CANCELLED"] as Status[]).map((s) => (
              <option key={s} value={s}>
                {t(`objetivos.status.${s}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </FilterSelect>
        }
        columns={[
          {
            key: "portfolioAccount",
            header: t("objetivos.col.account"),
            render: (r) => (r.portfolioAccount as { fullName: string } | undefined)?.fullName ?? "—"
          },
          {
            key: "type",
            header: t("objetivos.col.type"),
            render: (r) => (
              <Badge variant="secondary">
                {t(`objetivos.type.${r.type}` as Parameters<typeof t>[0])}
              </Badge>
            )
          },
          {
            key: "amount",
            header: t("objetivos.col.amount"),
            render: (r) => (r.amount != null ? money(r.amount as number) : "—")
          },
          {
            key: "dueDate",
            header: t("objetivos.col.dueDate"),
            render: (r) => new Date(r.dueDate as string).toLocaleDateString()
          },
          {
            key: "daysLeft",
            header: t("objetivos.col.daysLeft"),
            render: (r) => {
              const d = daysUntil(r.dueDate as string);
              const overdue = d < 0 && r.status === "PENDING";
              return overdue ? (
                <Badge variant="destructive">{t("objetivos.overdue")}</Badge>
              ) : (
                <span className="text-sm text-slate-600">{d}</span>
              );
            }
          },
          {
            key: "status",
            header: t("objetivos.col.status"),
            render: (r) => (
              <Badge variant={statusVariant(r.status as string)}>
                {t(`objetivos.status.${r.status}` as Parameters<typeof t>[0])}
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
                      label: t("objetivos.actions.markMet"),
                      onClick: () => update.mutate({ id: r.id as string, status: "MET" })
                    },
                    {
                      label: t("objetivos.actions.markBroken"),
                      onClick: () => update.mutate({ id: r.id as string, status: "BROKEN" })
                    },
                    {
                      label: t("objetivos.actions.markCancelled"),
                      onClick: () => update.mutate({ id: r.id as string, status: "CANCELLED" }),
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
