import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const iconLabelVariants = cva("inline-flex items-center gap-1.5 text-sm font-medium", {
  variants: {
    variant: {
      secondary: "text-slate-600",
      success: "text-emerald-600",
      violet: "text-violet-600",
      orange: "text-orange-600"
    }
  },
  defaultVariants: { variant: "secondary" }
});

export interface IconLabelProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof iconLabelVariants> {
  icon?: React.ReactNode;
}

export function IconLabel({ className, variant, icon, children, ...props }: IconLabelProps) {
  return (
    <span className={cn(iconLabelVariants({ variant }), className)} {...props}>
      {icon}
      {children}
    </span>
  );
}
