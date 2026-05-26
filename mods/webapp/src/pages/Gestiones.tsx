import { trpc } from "@/lib/trpc.js";
import { formatDate } from "@qcobro/common";

export function Gestiones() {
  const { data: gestiones = [], isLoading } = trpc.gestiones.list.useQuery({});

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Gestiones</h1>
      <div className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {["Cuenta", "Resultado", "Notas", "Fecha"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Cargando...</td></tr>
            ) : gestiones.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium font-mono text-xs">{g.cuentaId.slice(0, 8)}</td>
                <td className="px-4 py-3 text-gray-600">{g.resultado}</td>
                <td className="px-4 py-3 text-gray-500">{g.notas ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(g.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
