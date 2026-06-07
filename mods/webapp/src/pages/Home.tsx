import {
  Calendar,
  ChevronDown,
  PhoneCall,
  MessageSquare,
  PhoneMissed,
  Handshake,
  CalendarClock,
  type LucideIcon
} from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { Card } from "../components/ui/card.js";
import { cn } from "@/lib/utils.js";

const KPIS = [
  { label: "Recuperado", value: "$287,430", meta: "+12% vs. mes anterior" },
  { label: "Promesas de pago", value: "312", meta: "registradas hoy" },
  { label: "Tasa de contacto", value: "68%", meta: "+4 pts vs. semana" },
  { label: "Cuentas en gestión", value: "12,430", meta: "activas" }
];

const ACTIVITY: {
  icon: LucideIcon;
  name: string;
  desc: string;
  time: string;
  bg: string;
  fg: string;
}[] = [
  {
    icon: PhoneCall,
    name: "María González",
    desc: "Promesa de pago · $1,200",
    time: "Hace 5 min",
    bg: "bg-emerald-50",
    fg: "text-emerald-700"
  },
  {
    icon: MessageSquare,
    name: "Carlos Ruiz",
    desc: "Información confirmada",
    time: "Hace 22 min",
    bg: "bg-blue-50",
    fg: "text-blue-600"
  },
  {
    icon: PhoneMissed,
    name: "Ana Torres",
    desc: "Sin respuesta",
    time: "Hace 1 h",
    bg: "bg-red-50",
    fg: "text-red-600"
  },
  {
    icon: Handshake,
    name: "Luis Pérez",
    desc: "Cambio de términos",
    time: "Hace 2 h",
    bg: "bg-emerald-50",
    fg: "text-emerald-700"
  },
  {
    icon: CalendarClock,
    name: "Sofía Méndez",
    desc: "Reagendado para el viernes",
    time: "Hace 3 h",
    bg: "bg-orange-50",
    fg: "text-orange-600"
  }
];

const PROGRESS: [string, number][] = [
  ["Cartera Abril", 72],
  ["Cartera Marzo", 58],
  ["Fintech S.A.", 41],
  ["Cooperativa Norte", 86]
];

export function Home() {
  const { workspace } = useAuth();
  const workspaces = trpc.workspaces.list.useQuery();
  const active =
    workspaces.data?.items.find((w) => w.accessKeyId === workspace) ?? workspaces.data?.items[0];
  const wsName = active?.name ?? "tu espacio";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Panel de control</h1>
          <p className="text-sm text-slate-500">Resumen de {wsName}</p>
        </div>
        <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
          <Calendar className="h-4 w-4 text-slate-500" />
          Últimos 30 días
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {KPIS.map((k) => (
          <Card
            key={k.label}
            className="flex flex-col gap-1 rounded-xl border-slate-200 p-5 shadow-none"
          >
            <span className="text-[13px] font-medium text-slate-500">{k.label}</span>
            <span className="text-[28px] font-bold text-slate-900">{k.value}</span>
            <span className="text-xs text-slate-400">{k.meta}</span>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6">
        <Card className="rounded-xl border-slate-200 p-5 shadow-none">
          <h2 className="mb-2 text-[15px] font-semibold text-slate-900">Gestiones recientes</h2>
          <div className="flex flex-col">
            {ACTIVITY.map((a, i) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.name}
                  className={cn(
                    "flex items-center gap-3 py-3",
                    i < ACTIVITY.length - 1 && "border-b border-slate-100"
                  )}
                >
                  <span
                    className={cn("flex h-9 w-9 items-center justify-center rounded-full", a.bg)}
                  >
                    <Icon className={cn("h-[18px] w-[18px]", a.fg)} />
                  </span>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-slate-900">{a.name}</p>
                    <p className="text-xs text-slate-500">{a.desc}</p>
                  </div>
                  <span className="text-xs text-slate-400">{a.time}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="rounded-xl border-slate-200 p-5 shadow-none">
          <h2 className="mb-4 text-[15px] font-semibold text-slate-900">Progreso por cartera</h2>
          <div className="flex flex-col gap-4">
            {PROGRESS.map(([lbl, pct]) => (
              <div key={lbl} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-600">{lbl}</span>
                  <span className="font-semibold text-slate-900">{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
