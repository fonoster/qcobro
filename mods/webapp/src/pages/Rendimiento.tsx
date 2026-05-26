import { trpc } from "@/lib/trpc.js";

export function Rendimiento() {
  const { data } = trpc.rendimiento.dashboard.useQuery();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Rendimiento</h1>
      <div className="rounded-lg border bg-white p-6 shadow-sm text-sm text-gray-500">
        Charts and analytics coming soon — wired to live data via tRPC.
        {data && <pre className="mt-4 text-xs">{JSON.stringify(data, null, 2)}</pre>}
      </div>
    </div>
  );
}
