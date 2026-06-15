import { useState, type FormEvent } from "react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { InputGroup } from "../components/ui/input.js";

export function WorkspaceSettings() {
  const { workspace } = useAuth();
  const utils = trpc.useUtils();
  const workspaces = trpc.workspaces.list.useQuery();
  const update = trpc.workspaces.update.useMutation();

  const active =
    workspaces.data?.items.find((w) => w.accessKeyId === workspace) ?? workspaces.data?.items[0];

  // Uncontrolled-until-edited: the field shows the server name until the user
  // types, and resets to the server value after a successful save.
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<null | "ok" | "error">(null);
  const name = draft ?? active?.name ?? "";

  const dirty = !!active && name.trim().length > 0 && name.trim() !== active.name;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!active || !dirty) return;
    setStatus(null);
    try {
      await update.mutateAsync({ ref: active.ref, name: name.trim() });
      await utils.workspaces.list.invalidate();
      setDraft(null);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900">Configuración del espacio</h1>
        <p className="text-sm text-slate-500">
          Cambia el nombre de {active?.name ?? "tu espacio de trabajo"}
        </p>
      </div>

      <Card className="max-w-[680px] rounded-xl border-slate-200 shadow-none">
        <form onSubmit={onSubmit} className="flex flex-col gap-5 p-6">
          <h2 className="text-[15px] font-semibold text-slate-900">General</h2>
          <InputGroup
            label="Nombre del espacio"
            required
            value={name}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nombre del espacio"
          />
          <div className="flex items-center justify-end gap-3">
            {status === "ok" && (
              <span className="text-[13px] text-emerald-600">Cambios guardados</span>
            )}
            {status === "error" && (
              <span className="text-[13px] text-red-600">No se pudo guardar</span>
            )}
            <Button type="submit" disabled={!dirty || update.isPending}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
