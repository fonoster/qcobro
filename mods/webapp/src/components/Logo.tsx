import { cn } from "@/lib/utils.js";

/**
 * The QCobro brand mark: the "QCobro" wordmark alone — no "Q" tile, no "by Fonoster".
 * Colour follows the theme (`text-fg`: dark ink in light, near-white in dark). `variant`
 * "white" forces the light treatment for always-dark surfaces (the auth brand panel).
 * `collapsed` swaps the wordmark for just the "Q", for spaces too narrow for the full mark.
 */
export function Logo({
  className,
  variant = "default",
  collapsed = false
}: {
  className?: string;
  variant?: "default" | "white";
  collapsed?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-extrabold leading-none",
        collapsed ? "text-[26px]" : "text-[22px]",
        variant === "white" ? "text-white" : "text-fg",
        className
      )}
      style={{ letterSpacing: "-0.6px" }}
    >
      {collapsed ? "Q" : "QCobro"}
    </span>
  );
}
