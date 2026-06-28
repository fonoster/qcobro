import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, Settings } from "lucide-react";
import { trpc, REFRESH_TOKEN_KEY } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { Logo } from "../components/Logo.js";
import { AnnouncementBanner } from "../components/AnnouncementBanner.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { InputGroup } from "../components/ui/input.js";
import { SelectGroup } from "../components/ui/select.js";
import { TIMEZONES } from "../lib/timezones.js";

export function CreateWorkspace() {
  const { setTokens, setWorkspace, currentUser } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const workspaces = trpc.workspaces.summaries.useQuery();
  const create = trpc.workspaces.create.useMutation();
  const refresh = trpc.auth.refresh.useMutation();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<"USD" | "DOP">("USD");
  const [timezone, setTimezone] = useState(TIMEZONES[0]);

  const items = workspaces.data ?? [];
  const pending = create.isPending || refresh.isPending;

  function onSelect(accessKeyId: string) {
    setWorkspace(accessKeyId);
    navigate("/");
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const { ref } = await create.mutateAsync({ name, currency, timezone });

    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      const res = await refresh.mutateAsync({ refreshToken });
      setTokens(res.accessToken, res.refreshToken, res.idToken);
    }

    await utils.workspaces.summaries.invalidate();
    const list = await utils.workspaces.summaries.fetch();
    const created = list.find((w) => w.ref === ref) ?? list[0];
    if (created) setWorkspace(created.accessKeyId);
    navigate("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AnnouncementBanner />

      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-10">
        <Logo />
        {currentUser && (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200">
            <span className="text-[13px] font-bold text-slate-600">{currentUser.initials}</span>
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-10 py-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-[28px] font-bold text-slate-900">Hola, te damos la bienvenida 👋</h1>
          <p className="text-base text-slate-500">
            Crea un espacio de trabajo o entra a uno existente.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          {items.slice(0, 3).map((ws) => (
            <div
              key={ws.accessKeyId}
              onClick={() => onSelect(ws.accessKeyId)}
              className="relative flex h-[200px] w-[280px] cursor-pointer flex-col justify-between rounded-[10px] border border-slate-200 bg-white p-6 text-left transition hover:border-emerald-300 hover:shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <p className="text-[17px] font-bold text-slate-900">{ws.name}</p>
                <p className="text-[13px] text-slate-400">
                  {ws.portfolioCount} {ws.portfolioCount === 1 ? "cartera" : "carteras"} ·{" "}
                  {ws.memberCount} {ws.memberCount === 1 ? "miembro" : "miembros"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Configuración del espacio"
                onClick={(e) => {
                  e.stopPropagation();
                  setWorkspace(ws.accessKeyId);
                  navigate("/settings");
                }}
                className="absolute bottom-5 right-5 text-slate-400 transition hover:text-slate-700"
              >
                <Settings className="h-[18px] w-[18px]" />
              </button>
            </div>
          ))}

          <button
            onClick={() => setOpen(true)}
            className="flex h-[200px] w-[280px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-slate-300 bg-white text-slate-400 transition hover:border-emerald-400 hover:text-emerald-600"
          >
            <Plus className="h-7 w-7" />
            <span className="text-[15px] font-semibold">Nuevo espacio</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 p-4">
          <Card className="w-full max-w-[480px] rounded-2xl border-slate-200 shadow-xl">
            <form onSubmit={onCreate} className="flex flex-col gap-5 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[18px] font-bold text-slate-900">Crear espacio de trabajo</h2>
                  <p className="text-[13px] text-slate-500">
                    Un espacio agrupa tus carteras, campañas y equipo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="cursor-pointer text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <InputGroup
                label="Nombre del espacio"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Cartera Abril"
              />

              <SelectGroup label="Región" defaultValue="nyc01">
                <option value="nyc01">NYC01</option>
              </SelectGroup>

              <SelectGroup
                label="Moneda"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "USD" | "DOP")}
              >
                <option value="USD">USD</option>
                <option value="DOP">DOP</option>
              </SelectGroup>

              <SelectGroup
                label="Zona horaria"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </SelectGroup>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  Crear espacio
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
