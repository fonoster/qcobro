import type { ReactNode } from "react";
import { cn } from "@/lib/utils.js";

/**
 * A 44 px rounded square on --secondary holding a 20 px foreground icon (or mono initials).
 * Used by DetailHeader and EmptyState.
 *
 * @example <IconTile><Folder /></IconTile>
 */
export function IconTile({
  children,
  size = 44,
  className
}: {
  children: ReactNode;
  size?: 36 | 44;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px] bg-elevated font-mono text-sm text-fg [&>svg]:h-5 [&>svg]:w-5",
        className
      )}
    >
      {children}
    </span>
  );
}
