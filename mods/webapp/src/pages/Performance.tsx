import { trpc } from "@/lib/trpc.js";
import { t } from "@/lib/i18n.js";
import { formatMoney, formatPercent } from "@qcobro/common";
import { PageHeader } from "@/components/page-header.js";
import { SectionCard } from "@/components/section-card.js";
import { ProgressBarRow } from "@/components/progress-bar-row.js";
import { Badge } from "@/components/ui/badge.js";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

export function Performance() {
  const { data: trends, isLoading: trendsLoading } = trpc.performance.trends.useQuery();
  const { data: agents, isLoading: agentsLoading } = trpc.performance.byAgent.useQuery();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.performance.title} description={t.performance.description} />

      <SectionCard title={t.performance.contactRateTrend} description={t.performance.contactRateTrendDesc}>
        {trendsLoading ? (
          <p className="text-sm text-slate-500">{t.common.loading}</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trends ?? []} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis unit="%" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: unknown) => `${v}%`} />
              <Legend />
              <Line type="monotone" dataKey="rate" name="Contactabilidad" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <SectionCard title={t.performance.dailyVolume} description={t.performance.dailyVolumeDesc}>
        {trendsLoading ? (
          <p className="text-sm text-slate-500">{t.common.loading}</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trends ?? []} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="contacted" name="Contactados" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="total" name="Total" fill="#e5e7eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <SectionCard title={t.performance.agentPerformance} description={t.performance.agentPerformanceDesc}>
        {agentsLoading ? (
          <p className="text-sm text-slate-500">{t.common.loading}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-4">{t.agents.columns.name}</th>
                    <th className="pb-2 pr-4">{t.agents.columns.strategy}</th>
                    <th className="pb-2 pr-4">{t.agents.columns.calls}</th>
                    <th className="pb-2 pr-4">{t.agents.columns.promises}</th>
                    <th className="pb-2 pr-4">{t.agents.columns.recovered}</th>
                    <th className="pb-2">{t.agents.columns.successRate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(agents ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 pr-4 font-medium text-slate-900">{a.name}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={a.strategy === "AGGRESSIVE" ? "destructive" : a.strategy === "GENTLE" ? "success" : "secondary"}>
                          {t.common.strategy[a.strategy as keyof typeof t.common.strategy] ?? a.strategy}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-slate-700">{a.calls.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-slate-700">{a.promises.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-slate-700">{formatMoney(a.recovered)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-24">
                            <ProgressBarRow label="" value={a.successRate} max={100} displayValue="" />
                          </div>
                          <span className="text-xs font-medium text-slate-700">{formatPercent(a.successRate)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
