import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n, type Language } from "../lib/i18n.js";
import { useWorkspaceCurrency } from "../lib/useWorkspaceCurrency.js";
import { Card } from "../components/ui/card.js";
import { channelIcon } from "../lib/channelIcon.js";
import { cn } from "@/lib/utils.js";

/** Minimal shape of a recent gestión row used by the dashboard widget. */
type RecentGestion = {
  id: string;
  agentType: string;
  outcome: string;
  contactedAt: string | Date;
  portfolioAccount: { fullName: string } | null;
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

export function Home() {
  const { workspace } = useAuth();
  const { t, language } = useI18n();
  const wsCurrency = useWorkspaceCurrency();
  const workspaces = trpc.workspaces.list.useQuery();
  const active =
    workspaces.data?.items.find((w) => w.accessKeyId === workspace) ?? workspaces.data?.items[0];
  const wsName = active?.name ?? "tu espacio";

  const portfolios = trpc.portfolios.list.useQuery();
  const recent = trpc.campaigns.contactLog.list.useQuery({ limit: 5 });
  const promises = trpc.campaigns.paymentPromise.list.useQuery();
  const contactStats = trpc.portfolios.contactStats.useQuery();

  const carteras = portfolios.data ?? [];
  const accountsInManagement = carteras.reduce((sum, p) => sum + p.accountCount, 0);
  const recoveredTotal = carteras.reduce((sum, p) => sum + (p.recoveredAmount ?? 0), 0);
  const outstandingTotal = carteras.reduce((sum, p) => sum + (p.totalOutstandingBalance ?? 0), 0);
  const promisesKept = (promises.data ?? []).filter(
    (p) => (p as { status: string }).status === "MET"
  ).length;
  const cs = contactStats.data;
  const contactRate = cs && cs.total > 0 ? Math.round((cs.contacted / cs.total) * 100) : 0;
  const activity = (recent.data?.items ?? []) as RecentGestion[];

  const money = (v: number) =>
    new Intl.NumberFormat(language, {
      style: "currency",
      currency: wsCurrency,
      maximumFractionDigits: 0
    }).format(v);

  // All KPIs are sourced from live workspace data.
  const kpis: { label: string; value: string; meta: string }[] = [
    {
      label: t("home.kpi.recovered"),
      value: money(recoveredTotal),
      meta: t("home.kpi.recoveredMeta")
    },
    {
      label: t("home.kpi.promisesKept"),
      value: promisesKept.toLocaleString(),
      meta: t("home.kpi.promisesKeptMeta")
    },
    {
      label: t("home.kpi.contactRate"),
      value: `${contactRate}%`,
      meta: t("home.kpi.contactRateMeta")
    },
    {
      label: t("home.kpi.pendingBalance"),
      value: money(outstandingTotal),
      meta: t("home.kpi.pendingBalanceMeta")
    },
    {
      label: t("home.kpi.accountsInManagement"),
      value: accountsInManagement.toLocaleString(),
      meta: t("home.kpi.active")
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900">{t("home.title")}</h1>
        <p className="text-sm text-slate-500">{t("home.subtitle").replace("{name}", wsName)}</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="flex flex-col gap-1 rounded-xl border-slate-200 p-5 shadow-none"
          >
            <span className="text-[13px] font-medium text-slate-500">{k.label}</span>
            <span className="text-[28px] font-bold text-slate-900">{k.value}</span>
            <span className="text-xs text-slate-400">{k.meta}</span>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6">
        <Card className="rounded-xl border-slate-200 p-5 shadow-none">
          <h2 className="mb-2 text-[15px] font-semibold text-slate-900">
            {t("home.recentActivity")}
          </h2>
          {activity.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">{t("gestiones.empty")}</p>
          ) : (
            <div className="flex flex-col">
              {activity.map((a, i) => {
                const Icon = channelIcon(a.agentType);
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-center gap-3 py-3",
                      i < activity.length - 1 && "border-b border-slate-100"
                    )}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                      <Icon className="h-[18px] w-[18px] text-slate-500" />
                    </span>
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold text-slate-900">
                        {a.portfolioAccount?.fullName ?? "—"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t(`gestiones.outcome.${a.outcome}` as Parameters<typeof t>[0])}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatRelative(a.contactedAt, language)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="rounded-xl border-slate-200 p-5 shadow-none">
          <h2 className="mb-4 text-[15px] font-semibold text-slate-900">
            {t("home.progressByPortfolio")}
          </h2>
          {carteras.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">{t("home.noPortfolios")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {carteras.map((p) => {
                const pct = recoveryPct(p.recoveredAmount ?? 0, p.totalOutstandingBalance ?? 0);
                return (
                  <div key={p.id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-slate-600">{p.name}</span>
                      <span className="font-semibold text-slate-700">{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
