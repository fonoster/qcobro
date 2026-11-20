import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2 py-1 text-sm font-normal",
  {
    variants: {
      variant: {
        secondary: "bg-elevated text-fg",
        destructive: "bg-danger-soft text-danger"
      }
    },
    defaultVariants: { variant: "secondary" }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
