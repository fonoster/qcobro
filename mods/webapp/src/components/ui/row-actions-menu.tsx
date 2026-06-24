import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils.js";

export interface RowAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
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
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <Ellipsis className="h-[18px] w-[18px]" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-50 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
                  item.variant === "destructive" ? "text-red-600 hover:bg-red-50" : "text-slate-700"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
