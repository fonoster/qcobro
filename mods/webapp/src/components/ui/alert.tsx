import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils.js";

const alertVariants = cva("flex gap-3 rounded-lg p-4 text-sm", {
  variants: {
    variant: {
      error: "bg-danger-soft text-danger",
      success: "bg-primary/10 text-primary",
      warning: "bg-warning-soft text-warning",
      info: "bg-info-soft text-info"
    }
  },
  defaultVariants: { variant: "info" }
});

const icons = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
  description?: string;
}

export function Alert({
  className,
  variant = "info",
  title,
  description,
  children,
  ...props
}: AlertProps) {
  const Icon = icons[variant ?? "info"];
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title && <p className="font-medium leading-tight">{title}</p>}
        {description && <p className="mt-0.5 opacity-80">{description}</p>}
        {children}
      </div>
    </div>
  );
}
