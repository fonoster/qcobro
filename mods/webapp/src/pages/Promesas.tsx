import { trpc } from "@/lib/trpc.js";
import { formatMoney, formatDate } from "@qcobro/common";

const estadoStyles: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-700",
  CUMPLIDA: "bg-emerald-100 text-emerald-700",
  VENCIDA: "bg-red-100 text-red-700",
  CANCELADA: "bg-gray-100 text-gray-600"
};

export function Promesas() {
  const { data: promesas = [], isLoading } = trpc.promesas.list.useQuery({});

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Promesas de Pago</h1>
      <div className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {["Cuenta", "Monto", "Fecha promesa", "Estado"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Cargando...</td></tr>
            ) : promesas.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{p.cuentaId.slice(0, 8)}</td>
                <td className="px-4 py-3 font-medium">{formatMoney(p.monto)}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(p.fechaPromesa)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoStyles[p.estado] ?? ""}`}>
                    {p.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
