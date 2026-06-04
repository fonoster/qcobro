import { trpc } from "@/lib/trpc.js";
import { t } from "@/lib/i18n.js";
import { formatMoney, formatPercent, formatRelative } from "@qcobro/common";
import { KpiRow } from "@/components/kpi-card.js";
import { SectionCard } from "@/components/section-card.js";
import { ActivityItem } from "@/components/activity-item.js";
import { PageHeader } from "@/components/page-header.js";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

export function Dashboard() {
  const { data, isLoading } = trpc.performance.dashboard.useQuery();
  const { data: trends, isLoading: trendsLoading } = trpc.performance.trends.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">{t.common.loading}</p>
      </div>
    );
  }

  const kpis = data?.kpis;
  const recent = data?.recentActivity ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.dashboard.title} description={t.dashboard.description} />

      <KpiRow
        cards={[
          {
            label: t.dashboard.kpi.totalActivities,
            value: String(kpis?.totalActivities ?? 0),
            subtext: `${kpis?.activeCampaigns ?? 0} campañas activas`
          },
          {
            label: t.dashboard.kpi.contactRate,
            value: formatPercent(kpis?.contactRate ?? 0),
            trend: {
              value: `${kpis?.activeAgents ?? 0} agentes activos`,
              positive: (kpis?.contactRate ?? 0) >= 50
            }
          },
          {
            label: t.dashboard.kpi.todayPromises,
            value: String(kpis?.todayPromises ?? 0),
            subtext: `${kpis?.fulfilledPromises ?? 0} cumplidas en total`
          }
        ]}
      />

      <div className="grid grid-cols-2 gap-6">
        <SectionCard
          title={t.dashboard.charts.activityByDay}
          description="Cuentas contactadas por día"
        >
          {trendsLoading ? (
            <p className="text-sm text-slate-500">{t.common.loading}</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trends ?? []} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="contacted" name="Contactados" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="total" name="Total" fill="#e5e7eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard
          title={t.dashboard.charts.contactRateTrend}
          description="Tasa de contactabilidad diaria (%)"
        >
          {trendsLoading ? (
            <p className="text-sm text-slate-500">{t.common.loading}</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trends ?? []} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis unit="%" tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: unknown) => `${v}%`} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Contactabilidad"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={t.dashboard.recentActivity}
        description={t.dashboard.recentActivityDesc}
      >
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">{t.dashboard.noActivity}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.map((a) => (
              <ActivityItem
                key={a.id}
                actor="Agente"
                action={t.dashboard.activityOutcomes[a.outcome as keyof typeof t.dashboard.activityOutcomes] ?? a.outcome}
                target={a.accountId}
                timestamp={formatRelative(a.createdAt)}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
