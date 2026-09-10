import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary-hover",
        secondary: "bg-elevated text-fg-muted hover:bg-border",
        outline: "border border-border bg-surface text-fg-muted hover:bg-elevated",
        ghost: "text-fg-muted hover:bg-elevated",
        destructive: "bg-danger text-white hover:opacity-90"
      },
      size: {
        sm: "h-7 px-3 text-xs",
        default: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-base"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";

const iconButtonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary-hover",
        secondary: "bg-elevated text-fg-muted hover:bg-border",
        outline: "border border-border bg-surface text-fg-muted hover:bg-elevated",
        ghost: "text-fg-muted hover:bg-elevated",
        destructive: "bg-danger text-white hover:opacity-90"
      },
      size: {
        default: "h-9 w-9",
        lg: "h-11 w-11"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof iconButtonVariants> {}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(iconButtonVariants({ variant, size }), className)} {...props} />
  )
);
IconButton.displayName = "IconButton";
