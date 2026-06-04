import { Building2, Moon, ChevronDown } from "lucide-react";

export function TopBar() {
  const user = JSON.parse(localStorage.getItem("user") ?? "{}");
  const initials = (user.name ?? "Admin Usuario")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6 text-slate-500" />
        <span className="text-sm font-medium text-slate-900">Mikro Créditos</span>
        <ChevronDown className="h-5 w-5 text-slate-500" />
      </div>
      <div className="flex items-center gap-4">
        <button className="text-slate-500 hover:text-slate-700">
          <Moon className="h-6 w-6" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 border border-slate-200">
          <span className="text-sm font-semibold text-slate-900 leading-[1.43]">{initials}</span>
        </div>
        <span className="text-sm font-medium text-slate-900">
          {user.name ?? "Admin Usuario"}
        </span>
      </div>
    </header>
  );
}
