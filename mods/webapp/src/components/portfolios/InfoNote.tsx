import type { ReactNode } from "react";
import { Info } from "lucide-react";

/** A muted note inside a dialog's body: info icon and 12 px muted text on the muted fill. */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-control bg-elevated px-3 py-2.5 text-xs text-fg-muted">
      <Info className="mt-px h-3.5 w-3.5 shrink-0 text-fg" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
