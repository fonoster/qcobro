import { trpc } from "@/lib/trpc.js";
import { formatPercent, formatMoney } from "@qcobro/common";

export function Agentes() {
  const { data: agentes = [], isLoading } = trpc.agentes.list.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agentes IA</h1>
          <p className="text-sm text-gray-500">Gestiona agentes IA y su rendimiento</p>
        </div>
        <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          + Crear agente
        </button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Agentes activos" value={String(agentes.filter((a) => a.estado === "ACTIVO").length)} />
        <KpiCard label="Llamadas hechas" value={String(agentes.reduce((s, a) => s + a.llamadas, 0))} />
        <KpiCard label="Recuperado" value={formatMoney(agentes.reduce((s, a) => s + a.recuperado, 0))} />
        <KpiCard label="Tasa de éxito" value={formatPercent(agentes.reduce((s, a) => s + a.tasaExito, 0) / (agentes.length || 1))} />
      </div>
      <div className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {["Nombre", "Estrategia", "Estado", "Llamadas", "Promesas", "Tasa éxito"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Cargando...</td></tr>
            ) : agentes.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{a.nombre}</td>
                <td className="px-4 py-3 text-gray-600">{a.estrategia}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.estado === "ACTIVO" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                    {a.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{a.llamadas}</td>
                <td className="px-4 py-3 text-gray-600">{a.promesas}</td>
                <td className="px-4 py-3 text-gray-600">{formatPercent(a.tasaExito)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
