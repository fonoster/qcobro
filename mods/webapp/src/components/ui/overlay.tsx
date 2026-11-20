import { useEffect, useId, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { useI18n } from "@/lib/i18n.js";
import { Button } from "./button.js";

/**
 * Shared chrome for the two overlays, Dialog and Drawer: a header band (title, optional
 * subtitle, X) over a divider, the body, and a footer band with right-aligned actions.
 * Not exported from the barrel on purpose: pages use Dialog or Drawer.
 */
export interface OverlayChromeProps {
  open?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  /** One muted line (or more) under the title. */
  subtitle?: ReactNode;
  /** @deprecated Use `subtitle`. */
  description?: ReactNode;
  /** Extra header content under the title block (e.g. badges in a drawer). */
  headerExtra?: ReactNode;
  children?: ReactNode;
  /** Classes for the body (padding 24, gap 18 by default). */
  bodyClassName?: string;
  /**
   * The footer's buttons, right-aligned. Omit it to get the default pair (Cancelar, then the
   * primary `confirmLabel`) when `onConfirm`/`onSubmit` is set, or a single "Cerrar" otherwise.
   * Pass `null` for no footer at all.
   */
  footer?: ReactNode | null;
  /** Content at the footer's left end (e.g. an id or a hint). */
  footerLeft?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  /** Renders the overlay as a <form>; the default confirm button submits it. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  confirmDisabled?: boolean;
  confirmVariant?: "default" | "destructive";
  /** Icon shown before the confirm label. */
  confirmIcon?: ReactNode;
  /**
   * A submission error for the overlay as a whole (a server error). Field errors belong
   * under their field. Rendered above the footer, outside the scroll area, so it stays in
   * view of the button that caused it.
   */
  error?: string | null;
  /** Accessible name when there is no visible title. */
  "aria-label"?: string;
}

export function useEscapeToClose(open: boolean | undefined, onClose?: () => void) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

/** The X close button in an overlay header. */
export function OverlayClose({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      aria-label={t("common.closeDialog")}
      onClick={onClose}
      className="-mr-1 shrink-0 cursor-pointer rounded-md p-1 text-fg-muted hover:bg-elevated hover:text-fg"
    >
      <X className="h-[18px] w-[18px]" />
    </button>
  );
}

/**
 * Renders the header / body / footer of an overlay inside `Wrapper` props. The caller owns
 * the positioning panel (centered card or right-side drawer); this owns the content.
 */
export function OverlayContent({
  props,
  titleClassName,
  titleId
}: {
  props: OverlayChromeProps;
  titleClassName: string;
  titleId: string;
}) {
  const { t } = useI18n();
  const {
    onClose,
    title,
    subtitle,
    description,
    headerExtra,
    children,
    bodyClassName,
    footer,
    footerLeft,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onSubmit,
    confirmDisabled,
    confirmVariant = "default",
    confirmIcon,
    error
  } = props;
  const sub = subtitle ?? description;
  const hasConfirm = Boolean(onConfirm || onSubmit);
  const hasBody = children !== undefined && children !== null && children !== false;

  const defaultFooter = hasConfirm ? (
    <>
      <Button type="button" variant="ghost" onClick={onClose}>
        {cancelLabel ?? t("common.cancel")}
      </Button>
      <Button
        type={onSubmit ? "submit" : "button"}
        variant={confirmVariant}
        disabled={confirmDisabled}
        onClick={onSubmit ? undefined : onConfirm}
      >
        {confirmIcon}
        {confirmLabel ?? t("common.confirm")}
      </Button>
    </>
  ) : (
    <Button type="button" variant="outline" onClick={onClose}>
      {cancelLabel ?? t("common.close")}
    </Button>
  );
  const footerButtons = footer === undefined ? defaultFooter : footer;

  return (
    <>
      {(title || sub || headerExtra) && (
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {title && (
              <h2 id={titleId} className={cn("text-fg", titleClassName)}>
                {title}
              </h2>
            )}
            {sub && <div className="text-[13px] text-fg-muted">{sub}</div>}
            {headerExtra}
          </div>
          <OverlayClose onClose={onClose} />
        </div>
      )}
      {hasBody && (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto p-6",
            bodyClassName
          )}
        >
          {children}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mx-6 mb-4 flex shrink-0 items-center gap-2 rounded-control bg-danger-soft p-3 text-left text-sm font-medium text-danger"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {footerButtons !== null && (
        <div
          className={cn(
            "flex shrink-0 items-center gap-2.5 border-t border-border px-6 py-4",
            footerLeft ? "justify-between" : "justify-end"
          )}
        >
          {footerLeft && <div className="min-w-0 text-[13px] text-fg-muted">{footerLeft}</div>}
          <div className="flex items-center gap-2.5">{footerButtons}</div>
        </div>
      )}
    </>
  );
}

/** Wraps overlay content in a <form> when the overlay submits. */
export function OverlayForm({
  onSubmit,
  className,
  children
}: {
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  className: string;
  children: ReactNode;
}) {
  if (!onSubmit) return <div className={className}>{children}</div>;
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(e);
      }}
    >
      {children}
    </form>
  );
}

export function useOverlayTitleId() {
  return `overlay-title-${useId().replace(/:/g, "")}`;
}
