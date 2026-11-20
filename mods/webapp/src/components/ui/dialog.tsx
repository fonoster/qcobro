import { createPortal } from "react-dom";
import { cn } from "@/lib/utils.js";
import {
  OverlayContent,
  OverlayForm,
  useEscapeToClose,
  useOverlayTitleId,
  type OverlayChromeProps
} from "./overlay.js";

export interface DialogProps extends OverlayChromeProps {
  /** Panel width in px: 520 by default, 560 for longer forms, 480 for confirmations. */
  width?: number;
  /** Classes for the panel. */
  className?: string;
}

/**
 * A centered dialog for a short interruption: confirmations, typed deletes, one-time
 * secrets, pickers, short creates (four fields or fewer) and step flows. Header band (title
 * 16/600, optional subtitle, X) over a divider; body padding 24, gap 18; footer band with
 * right-aligned actions (Cancelar ghost, then the primary). Working on one record, or a long
 * sectioned form, is a Drawer instead.
 *
 * @example <Dialog open onClose={close} title="Nueva cartera" confirmLabel="Crear cartera" onSubmit={create}>…fields…</Dialog>
 */
export function Dialog(props: DialogProps) {
  const { open, onClose, width = 520, className, onSubmit, title } = props;
  const titleId = useOverlayTitleId();
  useEscapeToClose(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : props["aria-label"]}
        style={{ maxWidth: width }}
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-m border border-border bg-surface text-left shadow-[0_24px_64px_rgba(0,0,0,0.5)]",
          className
        )}
      >
        <OverlayForm onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <OverlayContent
            props={props}
            titleId={titleId}
            titleClassName="text-base font-semibold"
          />
        </OverlayForm>
      </div>
    </div>,
    document.body
  );
}
