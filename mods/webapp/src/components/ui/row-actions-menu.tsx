import type { ComponentType } from "react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils.js";

export interface RowAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
  icon?: ComponentType<{ className?: string }>;
}

export function RowActionsMenu({ items }: { items: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !btnRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        aria-label="Acciones"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-fg-subtle hover:bg-elevated hover:text-fg-muted"
      >
        <Ellipsis className="h-[18px] w-[18px]" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-50 w-60 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-md"
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    item.onClick();
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-left text-[13px] font-medium",
                    item.variant === "destructive"
                      ? "text-danger hover:bg-danger-soft"
                      : "text-fg hover:bg-elevated"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0 text-fg-muted" />}
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
