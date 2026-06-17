import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { InputGroup } from "../components/ui/input.js";

const CONFIRM_WORD = "ELIMINAR";

export function Profile() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const profile = trpc.profile.get.useQuery();
  const update = trpc.profile.update.useMutation();
  const remove = trpc.profile.delete.useMutation();

  const serverName = profile.data?.name ?? "";
  const serverPhone = profile.data?.phone ?? "";
  const email = profile.data?.email ?? "";

  // Uncontrolled-until-edited: fields show server values until the user types.
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [status, setStatus] = useState<null | "ok" | "error">(null);
  const nameValue = name ?? serverName;
  const phoneValue = phone ?? serverPhone;

  const dirty =
    !!profile.data &&
    nameValue.trim().length > 0 &&
    (nameValue.trim() !== serverName || phoneValue.trim() !== serverPhone);

  // Type-to-confirm account deletion.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    setStatus(null);
    try {
      await update.mutateAsync({ name: nameValue.trim(), phone: phoneValue.trim() || undefined });
      await profile.refetch();
      setName(null);
      setPhone(null);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setConfirmText("");
    setDeleteError(false);
  }

  async function onDelete() {
    if (!canDelete) return;
    setDeleteError(false);
    try {
      await remove.mutateAsync();
      // The account is gone; drop the session and return to login.
      logout();
      navigate("/login");
    } catch {
      setDeleteError(true);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900">Mi perfil</h1>
        <p className="text-sm text-slate-500">Actualiza tu información personal.</p>
      </div>

      <Card className="max-w-[680px] rounded-xl border-slate-200 shadow-none">
        <form onSubmit={onSubmit} className="flex flex-col gap-5 p-6">
          <h2 className="text-[15px] font-semibold text-slate-900">General</h2>
          <InputGroup
            id="profile-name"
            label="Nombre"
            required
            value={nameValue}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
          />
          <InputGroup
            id="profile-email"
            label="Correo"
            value={email}
            readOnly
            disabled
            hint="El correo no se puede cambiar."
          />
          <InputGroup
            id="profile-phone"
            label="Teléfono"
            value={phoneValue}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Opcional"
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

      <Card className="max-w-[680px] rounded-xl border-red-200 shadow-none">
        <div className="flex items-center justify-between gap-6 p-6">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Eliminar cuenta</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Esta acción es permanente. Se eliminará tu cuenta y perderás el acceso.
            </p>
          </div>
          <Button
            variant="outline"
            className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setConfirmOpen(true)}
          >
            Eliminar cuenta
          </Button>
        </div>
      </Card>

      {confirmOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
          <Card className="w-full max-w-[440px] rounded-2xl border-slate-200 shadow-xl">
            <div className="flex flex-col gap-5 p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Eliminar cuenta</h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  Esta acción es permanente. Se eliminará tu cuenta y perderás el acceso.
                </p>
              </div>
              <InputGroup
                label={`Escribe ${CONFIRM_WORD} para confirmar`}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoFocus
                error={deleteError ? "No se pudo eliminar la cuenta." : undefined}
              />
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeConfirm}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={!canDelete || remove.isPending}
                  onClick={onDelete}
                >
                  Eliminar cuenta
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
