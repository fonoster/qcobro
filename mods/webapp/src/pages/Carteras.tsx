import { trpc } from "@/lib/trpc.js";
import { formatMoney } from "@qcobro/common";

export function Carteras() {
  const { data: carteras = [], isLoading } = trpc.carteras.list.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Carteras</h1>
          <p className="text-sm text-gray-500">Gestiona tus carteras de cuentas por cobrar</p>
        </div>
        <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          + Importar cartera
        </button>
      </div>
      <div className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {["Nombre", "Cuentas", "Monto total", "Recuperado", "Estado"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Cargando...</td></tr>
            ) : carteras.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.nombre}</td>
                <td className="px-4 py-3 text-gray-600">{c.cuentas}</td>
                <td className="px-4 py-3 text-gray-600">{formatMoney(c.montoTotal)}</td>
                <td className="px-4 py-3 text-gray-600">{formatMoney(c.montoRecuperado)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.estado === "ACTIVA" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                    {c.estado}
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
