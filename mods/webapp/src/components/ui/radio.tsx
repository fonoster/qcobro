import { forwardRef } from "react";
import { cn } from "@/lib/utils.js";

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, id, ...props }, ref) => (
    <div className="flex items-start gap-3">
      <input
        ref={ref}
        type="radio"
        id={id}
        className={cn(
          "mt-0.5 h-4 w-4 border-slate-300 text-emerald-500 accent-emerald-500 focus:ring-emerald-500",
          className
        )}
        {...props}
      />
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <label htmlFor={id} className="text-sm font-medium text-slate-700 cursor-pointer">
              {label}
            </label>
          )}
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      )}
    </div>
  )
);
Radio.displayName = "Radio";
