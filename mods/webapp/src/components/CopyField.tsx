import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "../lib/i18n.js";
import { Button } from "./ui/button.js";
import { cn } from "@/lib/utils.js";

/** Writes a value to the clipboard and flips a transient "copied" flag. */
function useClipboard() {
  const [copied, setCopied] = useState(false);
  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return { copied, copy };
}

export interface CopyFieldProps {
  /** The exact value written to the clipboard (copied in full, even when displayed truncated). */
  value: string;
  /** Label shown above the value. Only rendered by the `field` variant. */
  label?: string;
  /**
   * `field` — labeled code box + outline copy button (dialogs).
   * `inline` — compact mono value + icon-only copy button, copies on click (cards, chips).
   */
  variant?: "field" | "inline";
  /** Accessible label for the copy control (used by the `inline` variant, which has no text). */
  copyAriaLabel?: string;
  className?: string;
}

/**
 * Reusable copy-to-clipboard control. The `field` variant is the labeled row used in
 * dialogs; the `inline` variant is a compact, click-to-copy chip used on the workspace
 * cards and dashboard. Both copy the full `value` regardless of how it is displayed, and
 * `inline` stops click propagation so it can live inside a clickable parent.
 */
export function CopyField({
  value,
  label,
  variant = "field",
  copyAriaLabel,
  className
}: CopyFieldProps) {
  const { t } = useI18n();
  const { copied, copy } = useClipboard();

  if (variant === "inline") {
    return (
      <button
        type="button"
        aria-label={copyAriaLabel ?? t("common.copy")}
        onClick={(e) => {
          e.stopPropagation();
          void copy(value);
        }}
        className={cn(
          "group flex min-w-0 items-center gap-1.5 font-mono text-[13px] text-slate-600 transition",
          className
        )}
      >
        <span className="truncate">{value}</span>
        {copied ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-hover:text-slate-700" />
        )}
      </button>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-800">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          onClick={() => void copy(value)}
          className="shrink-0"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? t("common.copied") : t("common.copy")}
        </Button>
      </div>
    </div>
  );
}
