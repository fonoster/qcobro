import { Bell, ChevronDown } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <span className="text-sm text-gray-500">Empresa de Cobranza XYZ</span>
      <div className="flex items-center gap-4">
        <button className="text-gray-500 hover:text-gray-700">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm font-medium">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
            AU
          </div>
          Admin Usuario
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    </header>
  );
}
