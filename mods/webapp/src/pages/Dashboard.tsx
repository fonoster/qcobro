import { trpc } from "@/lib/trpc.js";
import { formatPercent } from "@qcobro/common";

export function Dashboard() {
  const { data, isLoading } = trpc.rendimiento.dashboard.useQuery();

  if (isLoading) return <div className="text-sm text-gray-500">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Panel de Control</h1>
        <p className="text-sm text-gray-500">Resumen de indicadores en tiempo real</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Cuentas en gestión" value={String(data?.gestiones ?? 0)} />
        <KpiCard label="Tasa de Contactabilidad" value={formatPercent(data?.tasaContactabilidad ?? 0)} />
        <KpiCard label="Promesas vencidas" value={String(data?.promesasVencidas ?? 0)} />
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}
