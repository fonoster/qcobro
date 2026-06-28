import { Calendar, ChevronDown } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { useI18n, type Language } from "../lib/i18n.js";
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

/**
 * Deterministic, stable progress percentage (10–80%) for a cartera. There is no
 * recovery-progress metric yet, so this is simulated from the cartera id so the
 * same cartera always shows the same value across renders. The widget is labelled
 * "sample data" in the UI until a real metric is wired from the backend.
 */
function simulatedProgress(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 10 + (h % 71);
}

export function Home() {
  const { workspace } = useAuth();
  const { t, language } = useI18n();
  const workspaces = trpc.workspaces.list.useQuery();
  const active =
    workspaces.data?.items.find((w) => w.accessKeyId === workspace) ?? workspaces.data?.items[0];
  const wsName = active?.name ?? "tu espacio";

  const portfolios = trpc.portfolios.list.useQuery();
  const recent = trpc.campaigns.contactLog.list.useQuery({ limit: 5 });

  const carteras = portfolios.data ?? [];
  const accountsInManagement = carteras.reduce((sum, p) => sum + p.accountCount, 0);
  const activity = (recent.data?.items ?? []) as RecentGestion[];

  // Only "accounts in management" has a real backend source today. The other three
  // are sample figures, rendered greyed-out so they read as not-yet-implemented.
  const kpis: { label: string; value: string; meta: string; muted?: boolean }[] = [
    {
      label: t("home.kpi.recovered"),
      value: "$287,430",
      meta: t("home.kpi.recoveredMeta"),
      muted: true
    },
    {
      label: t("home.kpi.promisesKept"),
      value: "312",
      meta: t("home.kpi.promisesKeptMeta"),
      muted: true
    },
    {
      label: t("home.kpi.contactRate"),
      value: "68%",
      meta: t("home.kpi.contactRateMeta"),
      muted: true
    },
    {
      label: t("home.kpi.accountsInManagement"),
      value: accountsInManagement.toLocaleString(),
      meta: t("home.kpi.active")
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">{t("home.title")}</h1>
          <p className="text-sm text-slate-500">{t("home.subtitle").replace("{name}", wsName)}</p>
        </div>
        <button
          disabled
          title={t("common.comingSoon")}
          className="flex cursor-not-allowed items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-400 opacity-60"
        >
          <Calendar className="h-4 w-4 text-slate-400" />
          {t("home.dateRange")}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="flex flex-col gap-1 rounded-xl border-slate-200 p-5 shadow-none"
          >
            <span className="text-[13px] font-medium text-slate-500">{k.label}</span>
            <span
              className={cn("text-[28px] font-bold", k.muted ? "text-slate-400" : "text-slate-900")}
            >
              {k.value}
            </span>
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
            <p className="py-6 text-sm text-slate-400">{t("gestiones.empty")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {carteras.map((p) => {
                const pct = simulatedProgress(p.id);
                return (
                  <div key={p.id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-slate-600">{p.name}</span>
                      <span className="font-semibold text-slate-400">{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-slate-300" style={{ width: `${pct}%` }} />
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
