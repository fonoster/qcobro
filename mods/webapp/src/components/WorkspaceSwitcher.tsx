import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { trpc } from "../lib/trpc.js";
import { useAuth } from "../lib/auth.js";
import { cn } from "@/lib/utils.js";

function wsInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return chars.toUpperCase() || "WS";
}

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { workspace, setWorkspace } = useAuth();
  const workspaces = trpc.workspaces.list.useQuery();
  const [open, setOpen] = useState(false);

  const items = workspaces.data?.items ?? [];
  const active = items.find((w) => w.accessKeyId === workspace) ?? items[0];

  if (collapsed) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={active?.name ?? "Espacio"}
          className="flex h-[33px] w-10 items-center justify-center rounded-[10px] bg-primary/10 hover:bg-elevated"
        >
          <span className="text-[11px] font-bold text-primary">
            {wsInitials(active?.name ?? "WS")}
          </span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 z-20 mt-1.5 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
              <p className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-fg-subtle">
                ESPACIOS
              </p>
              {items.map((w) => {
                const isActive = w.accessKeyId === (active?.accessKeyId ?? "");
                return (
                  <button
                    key={w.accessKeyId}
                    type="button"
                    onClick={() => {
                      setWorkspace(w.accessKeyId);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-elevated",
                      isActive && "bg-elevated"
                    )}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
                      {wsInitials(w.name)}
                    </span>
                    <span className="flex-1 font-medium text-fg">{w.name}</span>
                    {isActive && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-[10px] border border-border bg-surface px-2.5 py-2 hover:bg-elevated"
      >
        <span className="truncate text-[14px] font-semibold text-fg">
          {active?.name ?? "Espacio"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-fg-subtle" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1.5 w-full rounded-xl border border-border bg-surface p-1.5 shadow-lg">
            <p className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-fg-subtle">
              ESPACIOS
            </p>
            {items.map((w) => {
              const isActive = w.accessKeyId === (active?.accessKeyId ?? "");
              return (
                <button
                  key={w.accessKeyId}
                  type="button"
                  onClick={() => {
                    setWorkspace(w.accessKeyId);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-elevated",
                    isActive && "bg-elevated"
                  )}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
                    {wsInitials(w.name)}
                  </span>
                  <span className="flex-1 font-medium text-fg">{w.name}</span>
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
