import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { localDateString, recoveryPeriodRange, type ContactStatsPeriod } from "@qcobro/common";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { deliveryLabel, outcomeLabel } from "../lib/contactAxes.js";
import { useI18n, type Language, type MessageId } from "../lib/i18n.js";
import { useCurrencySymbol, useMoney, useWorkspaceTimezone } from "../lib/useWorkspaceCurrency.js";
import { KpiCard } from "../components/kpi-card.js";
import { PageHeader } from "../components/page-header.js";
import { SegmentedControl } from "../components/ui/segmented.js";
import { Input } from "../components/ui/input.js";
import { DataTable, TableCellStack } from "../components/ui/data-table.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { channelIcon } from "../lib/channelIcon.js";

/** The page-level time filter. It drives Recuperado, Progreso por cartera and Contacto. */
const PANEL_PERIODS = ["today", "7d", "thisMonth", "custom"] as const;
type PanelPeriod = (typeof PANEL_PERIODS)[number];

/** The rolling windows `portfolios.contactStats` supports, in days. */
const CONTACT_WINDOWS: [ContactStatsPeriod, number][] = [
  ["24h", 1],
  ["7d", 7],
  ["14d", 14],
  ["28d", 28]
];

const RECENT_LIMIT = 9;

/** Minimal shape of a recent gestión row used by the dashboard widget. */
type RecentGestion = {
  id: string;
  agentType: string;
  delivery: string;
  deliveryReason: string | null;
  outcome: string | null;
  contactedAt: string | Date;
  portfolioAccount: { fullName: string; externalId?: string } | null;
};

/** Relative timestamp ("Hace 5 min" / "5 min ago") localized to the active language. */
function formatRelative(date: Date | string, language: Language): string {
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  const diffMs = new Date(date).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const absMin = Math.abs(diffMin);
  if (absMin < 60) return rtf.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  return rtf.format(Math.round(diffHr / 24), "day");
}

/** Real recovery progress for a cartera: recovered / (recovered + outstanding). */
function recoveryPct(recovered: number, outstanding: number): number {
  const denom = recovered + outstanding;
  return denom > 0 ? Math.min(100, Math.round((recovered / denom) * 100)) : 0;
}

/** `YYYY-MM-DD` shifted by `days` (calendar arithmetic, no timezone involved). */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive length in days of a `YYYY-MM-DD` range. */
function rangeDays(range: { from: string; to: string }): number {
  const ms = Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * The rolling contact window closest to the period. Contacto is computed over rolling windows
 * only, so a calendar period (Este mes, Personalizado) reads the nearest one and the card's
 * label names the window it actually shows.
 */
function contactWindowFor(days: number): ContactStatsPeriod {
  return CONTACT_WINDOWS.reduce((best, w) =>
    Math.abs(w[1] - days) < Math.abs(best[1] - days) ? w : best
  )[0];
}

export function Home() {
  const { workspace } = useAuth();
  const currencySymbol = useCurrencySymbol();
  const { t, language } = useI18n();
  const money = useMoney();
  const workspaces = trpc.workspaces.list.useQuery();
  const active =
    workspaces.data?.items.find((w) => w.accessKeyId === workspace) ?? workspaces.data?.items[0];
  const wsName = active?.name ?? "tu espacio";
  const timeZone = useWorkspaceTimezone();

  const [period, setPeriod] = useState<PanelPeriod>("thisMonth");
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);

  const today = timeZone ? localDateString(new Date(), timeZone) : undefined;
  const thisMonth = timeZone ? recoveryPeriodRange("thisMonth", timeZone) : undefined;
  const customRange = custom ?? thisMonth;
  const customInvalid = !!customRange && customRange.from > customRange.to;
  const range: { from: string; to: string } | undefined = !today
    ? undefined
    : period === "today"
      ? { from: today, to: today }
      : period === "7d"
        ? { from: addDays(today, -6), to: today }
        : period === "thisMonth"
          ? thisMonth
          : customInvalid
            ? undefined
            : customRange;

  // Contacto follows the filter through the nearest rolling window it supports.
  const contactWindow: ContactStatsPeriod =
    period === "today"
      ? "24h"
      : period === "7d"
        ? "7d"
        : range
          ? contactWindowFor(rangeDays(range))
          : "7d";

  const portfolios = trpc.portfolios.list.useQuery();
  const recent = trpc.campaigns.contactLog.list.useQuery({ limit: RECENT_LIMIT });
  const promises = trpc.campaigns.paymentPromise.list.useQuery();
  const contactStats = trpc.portfolios.contactStats.useQuery({ period: contactWindow });

  const carteras = portfolios.data ?? [];
  // Recuperado and Progreso por cartera read the same period: the page's filter.
  const recovery = trpc.recovery.summary.useQuery(range ?? skipToken);
  const recoveryByPortfolio = trpc.useQueries((q) =>
    range ? carteras.map((p) => q.recovery.summary({ ...range, portfolioId: p.id })) : []
  );
  const accountsInManagement = carteras.reduce((sum, p) => sum + p.accountCount, 0);
  const outstandingTotal = carteras.reduce((sum, p) => sum + (p.totalOutstandingBalance ?? 0), 0);
  // Promises carry no "met at" date, so this stays the all-time count of kept promises.
  const promisesKept = (promises.data ?? []).filter(
    (p) => (p as { status: string }).status === "MET"
  ).length;
  const cs = contactStats.data;
  // A window with no gestiones at all renders "—", never 0%: a zero denominator rendering as
  // 0% is the most common way a rate like this lies.
  const contactRateEmpty = !cs || cs.totalSends === 0;
  const contactRatePct = cs && cs.total > 0 ? Math.round((cs.contacted / cs.total) * 100) : 0;
  const contactRateValue = contactRateEmpty
    ? t("home.contactRate.emptyValue")
    : `${contactRatePct}%`;
  const contactRateSubtext = contactRateEmpty
    ? t("home.contactRate.empty")
    : t("home.contactRate.subline")
        .replace("{contacted}", String(cs?.contacted ?? 0))
        .replace("{total}", String(cs?.total ?? 0))
        .replace("{sends}", String(cs?.totalSends ?? 0));
  const activity = (recent.data?.items ?? []) as RecentGestion[];

  // "—" only when nothing at all was detected in the period; recoveries that came in without a
  // gestión still show RD$ 0 next to them, so their line has a figure to qualify.
  const rs = recovery.data;
  const recoveredEmpty = !rs || (rs.count === 0 && rs.withoutGestionCount === 0);
  const recoveredValue = recoveredEmpty ? t("home.recovered.emptyValue") : money(rs.recovered);
  const recoveredSubtext = recoveredEmpty
    ? t("home.recovered.empty")
    : t("home.recovered.subline").replace("{count}", rs.count.toLocaleString());
  const recoveredDetail =
    rs && rs.withoutGestionCount > 0
      ? t("home.recovered.withoutGestion")
          .replace("{amount}", money(rs.withoutGestion))
          .replace("{count}", rs.withoutGestionCount.toLocaleString())
      : undefined;

  const shortDate = (date: string) =>
    new Intl.DateTimeFormat(language, { day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(`${date}T00:00:00Z`)
    );
  const periodInline =
    period === "custom"
      ? customRange
        ? `${shortDate(customRange.from)} – ${shortDate(customRange.to)}`
        : ""
      : t(`home.period.inline.${period}` as MessageId);

  const kpis: {
    label: string;
    value: string;
    meta: string;
    metaClassName?: string;
    detail?: string;
  }[] = [
    {
      label: t("home.kpi.accountsInManagement"),
      value: accountsInManagement.toLocaleString(),
      meta: t("home.kpi.active")
    },
    {
      label: t("home.kpi.pendingBalance"),
      value: money(Math.trunc(outstandingTotal)),
      meta: t("home.kpi.pendingBalanceMeta")
    },
    {
      label: t("home.kpi.recovered"),
      value: recoveredValue,
      meta: recoveredSubtext,
      metaClassName: "text-fg-muted",
      detail: recoveredDetail
    },
    {
      label: `${t("home.kpi.contactRate")} · ${t(`home.contactRate.window.${contactWindow}` as MessageId)}`,
      value: contactRateValue,
      meta: contactRateSubtext
    },
    {
      label: t("home.kpi.promisesKept"),
      value: promisesKept.toLocaleString(),
      meta: t("home.kpi.promisesKeptMeta")
    }
  ];

  const selectPeriod = (next: PanelPeriod) => {
    if (next === "custom" && !custom && thisMonth) setCustom(thisMonth);
    setPeriod(next);
  };

  return (
    <div className="flex min-h-full flex-col gap-5">
      <PageHeader
        title={t("home.title")}
        description={t("home.subtitle")
          .replace("{name}", wsName)
          .replace("{currency}", currencySymbol)}
        actions={
          <>
            {period === "custom" && customRange && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  aria-label={t("home.period.from")}
                  className="h-9 w-[150px] font-mono text-xs"
                  value={customRange.from}
                  max={today}
                  invalid={customInvalid}
                  onChange={(e) =>
                    e.target.value && setCustom({ ...customRange, from: e.target.value })
                  }
                />
                <span className="text-fg-muted">–</span>
                <Input
                  type="date"
                  aria-label={t("home.period.to")}
                  className="h-9 w-[150px] font-mono text-xs"
                  value={customRange.to}
                  max={today}
                  invalid={customInvalid}
                  onChange={(e) =>
                    e.target.value && setCustom({ ...customRange, to: e.target.value })
                  }
                />
              </div>
            )}
            <SegmentedControl
              aria-label={t("home.period.ariaLabel")}
              value={period}
              onChange={selectPeriod}
              options={PANEL_PERIODS.map((p) => ({
                value: p,
                label: t(`home.period.${p}` as MessageId)
              }))}
            />
          </>
        }
      />

      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            className="gap-2.5 rounded-xl px-[18px] py-4 shadow-none"
            label={k.label}
            value={k.value}
            subtext={k.meta}
            subtextClassName={k.metaClassName}
            detail={k.detail}
            notesUnderValue
          />
        ))}
      </div>

      <div className="grid flex-1 grid-cols-[1fr_380px] gap-4">
        <section aria-label={t("home.recentActivity")} className="flex min-w-0 flex-col">
          {activity.length === 0 ? (
            <EmptyState
              className="flex-1"
              icon={<Activity />}
              title={t("home.recentActivity")}
              body={t("gestiones.empty")}
            />
          ) : (
            <DataTable<RecentGestion & Record<string, unknown>>
              className="flex-1 [&>div]:flex-1"
              searchable={false}
              rowHeight={48}
              data={activity as (RecentGestion & Record<string, unknown>)[]}
              keyField="id"
              columns={[
                {
                  key: "portfolioAccount",
                  header: t("home.recent.col.account"),
                  render: (a) => (
                    <TableCellStack
                      title={a.portfolioAccount?.fullName ?? "—"}
                      sub={a.portfolioAccount?.externalId}
                    />
                  )
                },
                {
                  key: "agentType",
                  header: t("home.recent.col.channel"),
                  width: 140,
                  render: (a) => {
                    const Icon = channelIcon(a.agentType);
                    return (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Icon className="h-4 w-4 text-fg-muted" />
                        {t(`agents.type.${a.agentType}` as MessageId)}
                      </span>
                    );
                  }
                },
                {
                  key: "outcome",
                  header: t("home.recent.col.result"),
                  width: 220,
                  render: (a) =>
                    outcomeLabel(t, a.outcome) ??
                    deliveryLabel(t, a.delivery, a.deliveryReason, a.agentType)
                },
                {
                  key: "contactedAt",
                  header: t("home.recent.col.when"),
                  width: 110,
                  render: (a) => (
                    <span className="whitespace-nowrap text-fg-muted">
                      {formatRelative(a.contactedAt, language)}
                    </span>
                  )
                }
              ]}
            />
          )}
        </section>

        <section
          role="region"
          aria-labelledby="home-progress-by-portfolio"
          className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="home-progress-by-portfolio" className="text-sm font-medium text-fg">
              {t("home.progressTitle")}
            </h2>
            <span className="text-xs text-fg-muted">{periodInline}</span>
          </div>
          {carteras.length === 0 ? (
            <p className="py-6 text-sm text-fg-muted">{t("home.noPortfolios")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {carteras.map((p, i) => {
                const recovered = recoveryByPortfolio[i]?.data?.recovered ?? 0;
                const pct = recoveryPct(recovered, p.totalOutstandingBalance ?? 0);
                return (
                  <div key={p.id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between gap-3 text-[13px]">
                      <span className="truncate text-fg-muted">{p.name}</span>
                      <span className="shrink-0 font-mono text-xs text-fg">
                        {pct}% · {money(recovered)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-elevated">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
