import { trpc } from "@/lib/trpc.js";

const estadoStyles: Record<string, string> = {
  EN_CURSO: "bg-emerald-100 text-emerald-700",
  PROGRAMADA: "bg-blue-100 text-blue-700",
  COMPLETADA: "bg-gray-100 text-gray-600",
  CANCELADA: "bg-red-100 text-red-700"
};

export function Campanas() {
  const { data: campanas = [], isLoading } = trpc.campanas.list.useQuery({});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campañas</h1>
          <p className="text-sm text-gray-500">Administra campañas de cobranza</p>
        </div>
        <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          + Crear campaña
        </button>
      </div>
      <div className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {["Nombre", "Estado", "Cuentas"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Cargando...</td></tr>
            ) : campanas.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.nombre}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoStyles[c.estado] ?? "bg-gray-100 text-gray-600"}`}>
                    {c.estado.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.cuentas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
