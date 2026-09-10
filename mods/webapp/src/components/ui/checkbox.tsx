import { forwardRef } from "react";
import { cn } from "@/lib/utils.js";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, ...props }, ref) => (
    <div className="flex items-start gap-3">
      <input
        ref={ref}
        type="checkbox"
        id={id}
        className={cn(
          "mt-0.5 h-4 w-4 rounded border-border text-primary accent-emerald-500 focus:ring-ring",
          className
        )}
        {...props}
      />
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <label htmlFor={id} className="text-sm font-medium text-fg-muted cursor-pointer">
              {label}
            </label>
          )}
          {description && <p className="text-xs text-fg-subtle">{description}</p>}
        </div>
      )}
    </div>
  )
);
Checkbox.displayName = "Checkbox";
