import { createPortal } from "react-dom";
import { cn } from "@/lib/utils.js";
import { SlideOver } from "./slide-over.js";
import {
  OverlayContent,
  OverlayForm,
  useEscapeToClose,
  useOverlayTitleId,
  type OverlayChromeProps
} from "./overlay.js";

export interface DrawerProps extends OverlayChromeProps {
  /** Panel width in px: 480 by default, 560 for record details and long forms. */
  width?: number;
  /** Classes for the panel. */
  className?: string;
}

/**
 * A right-side drawer for working on one record: row details and long or sectioned
 * create/edit forms. Same structure as Dialog — header band (title 18/500, subtitle,
 * `headerExtra`, X), scrolling body (padding 24, gap 22), footer band with right-aligned
 * actions — anchored to the right edge at full height.
 *
 * @example <Drawer open onClose={close} title="Nueva campaña" subtitle="…" width={560} confirmLabel="Crear campaña" onSubmit={create}>…</Drawer>
 */
export function Drawer(props: DrawerProps) {
  const { open, onClose, width = 480, className, onSubmit, title, bodyClassName } = props;
  const titleId = useOverlayTitleId();
  useEscapeToClose(open, onClose);
  if (!open || !onClose) return null;

  return createPortal(
    <SlideOver
      open
      onClose={onClose}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : props["aria-label"]}
      style={{ maxWidth: width }}
      className={cn("overflow-hidden border-l border-border bg-surface", className)}
    >
      <OverlayForm onSubmit={onSubmit} className="flex h-full min-h-0 flex-col">
        <OverlayContent
          props={{ ...props, bodyClassName: cn("gap-[22px]", bodyClassName) }}
          titleId={titleId}
          titleClassName="text-lg font-medium"
        />
      </OverlayForm>
    </SlideOver>,
    document.body
  );
}
