import { useState, type ComponentType, type FormEvent } from "react";
import { Plus, X, MoreHorizontal, Mail, Ban, UserMinus } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { Card } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { InputGroup } from "../components/ui/input.js";
import { SelectGroup } from "../components/ui/select.js";
import { cn } from "@/lib/utils.js";

const ROLE_LABEL: Record<string, string> = {
  WORKSPACE_OWNER: "Propietario",
  WORKSPACE_ADMIN: "Admin",
  WORKSPACE_MEMBER: "Miembro"
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Activo", PENDING: "Pendiente" };

type Row = {
  ref: string;
  name: string;
  email: string;
  role: string;
  status: string;
  removable: boolean;
};

function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span className={cn("text-[13px] font-medium", active ? "text-slate-600" : "text-slate-400")}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50"
    >
      <Icon className="h-4 w-4 text-slate-500" />
      {label}
    </button>
  );
}

function initialsOf(name: string, email: string) {
  const base = name?.trim() || email?.split("@")[0] || "";
  const p = base.split(/[\s.]+/).filter(Boolean);
  return ((p.length >= 2 ? p[0][0] + p[1][0] : base.slice(0, 2)) || "?").toUpperCase();
}

export function Members() {
  const { workspace, currentUser } = useAuth();
  const utils = trpc.useUtils();
  const workspaces = trpc.workspaces.list.useQuery();
  const members = trpc.workspaces.listMembers.useQuery();
  const invite = trpc.workspaces.invite.useMutation();
  const remove = trpc.workspaces.removeMember.useMutation();
  const resend = trpc.workspaces.resendInvitation.useMutation();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("WORKSPACE_MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    message: string;
    confirmLabel: string;
    run: () => Promise<void>;
  }>(null);

  const wsName =
    workspaces.data?.items.find((w) => w.accessKeyId === workspace)?.name ?? "este espacio";

  // The owner isn't a member row in Identity — show the current user as owner first.
  const ownerRow: Row | null = currentUser
    ? {
        ref: "owner",
        name: currentUser.name,
        email: currentUser.email,
        role: "WORKSPACE_OWNER",
        status: "ACTIVE",
        removable: false
      }
    : null;
  const rows: Row[] = [
    ...(ownerRow ? [ownerRow] : []),
    ...(members.data?.items ?? []).map((m) => ({
      ref: m.userRef,
      name: m.name || m.email,
      email: m.email,
      role: m.role,
      status: m.status,
      removable: true
    }))
  ];

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await invite.mutateAsync({
        name,
        email,
        role: role as "WORKSPACE_ADMIN" | "WORKSPACE_MEMBER"
      });
      await utils.workspaces.listMembers.invalidate();
      setOpen(false);
      setName("");
      setEmail("");
      setRole("WORKSPACE_MEMBER");
    } catch {
      setError("No se pudo enviar la invitación.");
    }
  }

  async function onRemove(userRef: string) {
    await remove.mutateAsync({ userRef });
    await utils.workspaces.listMembers.invalidate();
  }

  async function onResend(userRef: string) {
    await resend.mutateAsync({ userRef });
  }

  function askRemove(r: Row) {
    setConfirm({
      title: "¿Quitar a este miembro?",
      message: `${r.name} perderá acceso a ${wsName}. Esta acción no se puede deshacer.`,
      confirmLabel: "Quitar",
      run: () => onRemove(r.ref)
    });
  }

  function askCancel(r: Row) {
    setConfirm({
      title: "¿Cancelar invitación?",
      message: `Se cancelará la invitación de ${r.name}.`,
      confirmLabel: "Cancelar invitación",
      run: () => onRemove(r.ref)
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">Miembros</h1>
          <p className="text-sm text-slate-500">Gestiona quién tiene acceso a {wsName}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Invitar miembro
        </Button>
      </div>

      <Card className="rounded-xl border-slate-200 shadow-none">
        <div className="flex items-center rounded-t-xl border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold tracking-wide text-slate-400">
          <span className="flex-1">MIEMBRO</span>
          <span className="w-40">ROL</span>
          <span className="w-32">ESTADO</span>
          <span className="w-10" />
        </div>
        {members.isLoading ? (
          <p className="px-5 py-6 text-sm text-slate-400">Cargando…</p>
        ) : (
          rows.map((r, i) => (
            <div
              key={r.ref}
              className={cn(
                "flex items-center px-5 py-3.5",
                i < rows.length - 1 && "border-b border-slate-100"
              )}
            >
              <div className="flex flex-1 items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                  {initialsOf(r.name, r.email)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-400">{r.email}</p>
                </div>
              </div>
              <div className="w-40">
                <span className="text-sm font-medium text-slate-600">
                  {ROLE_LABEL[r.role] ?? r.role}
                </span>
              </div>
              <div className="w-32">
                <StatusBadge status={r.status} />
              </div>
              <div className="relative flex w-10 justify-center">
                {r.removable && (
                  <>
                    <button
                      type="button"
                      onClick={() => setOpenMenu(openMenu === r.ref ? null : r.ref)}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Acciones"
                    >
                      <MoreHorizontal className="h-[18px] w-[18px]" />
                    </button>
                    {openMenu === r.ref && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                        <div className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                          {r.status === "PENDING" ? (
                            <>
                              <MenuItem
                                icon={Mail}
                                label="Reenviar invitación"
                                onClick={() => {
                                  setOpenMenu(null);
                                  onResend(r.ref);
                                }}
                              />
                              <MenuItem
                                icon={Ban}
                                label="Cancelar invitación"
                                onClick={() => {
                                  setOpenMenu(null);
                                  askCancel(r);
                                }}
                              />
                            </>
                          ) : (
                            <MenuItem
                              icon={UserMinus}
                              label="Quitar miembro"
                              onClick={() => {
                                setOpenMenu(null);
                                askRemove(r);
                              }}
                            />
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </Card>

      {open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 p-4">
          <Card className="w-full max-w-[440px] rounded-2xl border-slate-200 shadow-xl">
            <form onSubmit={onInvite} className="flex flex-col gap-5 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Invitar miembro</h2>
                  <p className="text-[13px] text-slate-500">
                    Enviaremos una invitación a {wsName}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <InputGroup
                label="Nombre"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la persona"
              />
              <InputGroup
                label="Correo electrónico"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@empresa.com"
                error={error ?? undefined}
              />
              <SelectGroup label="Rol" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="WORKSPACE_MEMBER">Miembro</option>
                <option value="WORKSPACE_ADMIN">Admin</option>
              </SelectGroup>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={invite.isPending}>
                  Enviar invitación
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
          <Card className="w-full max-w-[440px] rounded-2xl border-slate-200 shadow-xl">
            <div className="flex flex-col gap-5 p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{confirm.title}</h2>
                <p className="mt-1 text-[13px] text-slate-500">{confirm.message}</p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setConfirm(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={async () => {
                    await confirm.run();
                    setConfirm(null);
                  }}
                >
                  {confirm.confirmLabel}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
