import { cn } from "@/lib/utils.js";

/**
 * The QCobro brand mark: the "QCobro" wordmark alone — no "Q" tile, no "by Fonoster".
 * Colour follows the theme (`text-fg`: dark ink in light, near-white in dark).
 * `collapsed` swaps the wordmark for just the "Q", for spaces too narrow for the full mark.
 */
export function Logo({
  className,
  collapsed = false
}: {
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-extrabold leading-none",
        collapsed ? "text-[26px]" : "text-[22px]",
        "text-fg",
        className
      )}
      style={{ letterSpacing: "-0.6px" }}
    >
      {collapsed ? "Q" : "QCobro"}
    </span>
  );
}
