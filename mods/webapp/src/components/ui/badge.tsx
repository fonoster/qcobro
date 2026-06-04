import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2 py-1 text-sm font-normal",
  {
    variants: {
      variant: {
        success: "bg-[#ECFDF5] text-[#10B981]",
        orange: "bg-[#FFFBEB] text-[#D97706]",
        violet: "bg-violet-100 text-violet-700",
        secondary: "bg-slate-100 text-slate-900",
        destructive: "bg-red-100 text-red-700"
      }
    },
    defaultVariants: { variant: "secondary" }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
