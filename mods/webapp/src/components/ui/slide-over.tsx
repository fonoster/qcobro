import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils.js";

export interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}

/**
 * The bare right-anchored panel over a dimmed backdrop. Clicking the backdrop closes it.
 * Pages use Drawer (ui/drawer.tsx), which adds the header, body and footer bands on top of
 * this; SlideOver stays for content that draws its own chrome.
 */
export function SlideOver({ open, onClose, children, className, style, ...aria }: SlideOverProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-overlay" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        {...aria}
        style={style}
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-surface shadow-2xl",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
