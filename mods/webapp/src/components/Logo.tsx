import { cn } from "@/lib/utils.js";

/**
 * The QCobro brand mark: the "QCobro" wordmark alone — no "Q" tile, no "by Fonoster".
 * Colour follows the theme (`text-fg`: dark ink in light, near-white in dark). `variant`
 * "white" forces the light treatment for always-dark surfaces (the auth brand panel).
 */
export function Logo({
  className,
  variant = "default"
}: {
  className?: string;
  variant?: "default" | "white";
}) {
  return (
    <span
      className={cn(
        "text-[22px] font-extrabold leading-none",
        variant === "white" ? "text-white" : "text-fg",
        className
      )}
      style={{ letterSpacing: "-0.6px" }}
    >
      QCobro
    </span>
  );
}
