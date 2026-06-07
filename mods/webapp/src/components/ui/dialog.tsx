import { X } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { Button } from "./button.js";

export interface DialogProps {
  open?: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  align?: "center" | "left";
  icon?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  align = "left",
  icon,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  onConfirm
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl",
          align === "center" && "text-center",
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
        {icon && (
          <div className={cn("mb-4", align === "center" && "flex justify-center")}>{icon}</div>
        )}
        {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        {children}
        <div className={cn("mt-5 flex gap-3", align === "center" && "justify-center")}>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
