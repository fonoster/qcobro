import type { ReactNode } from "react";
import { cn } from "@/lib/utils.js";

export interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
  className?: string;
}

/**
 * A right-anchored slide-over panel rendered over a dimmed backdrop — the
 * "panel lateral sobre el dashboard" pattern. Clicking the backdrop closes it.
 */
export function SlideOver({ open, onClose, children, className }: SlideOverProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
