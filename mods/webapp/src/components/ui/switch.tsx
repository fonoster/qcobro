import { forwardRef } from "react";
import { cn } from "@/lib/utils.js";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, id, checked, onChange, ...props }, ref) => (
    <div className="flex items-center gap-3">
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
          {...props}
        />
        <div
          className={cn(
            "h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-500 peer-focus:ring-2 peer-focus:ring-emerald-500/20",
            "after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4",
            className
          )}
        />
      </label>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700 cursor-pointer">
          {label}
        </label>
      )}
    </div>
  )
);
Switch.displayName = "Switch";
