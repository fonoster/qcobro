import { forwardRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils.js";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export interface InputGroupProps extends InputProps {
  label?: string;
  hint?: string;
  error?: string;
}

export function InputGroup({ label, hint, error, className, id, ...props }: InputGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <Input id={id} className={error ? "border-red-500 focus:ring-red-500/20" : ""} {...props} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export type SearchBoxProps = React.InputHTMLAttributes<HTMLInputElement>;

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  ({ className, ...props }, ref) => (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={ref}
        className="flex h-9 w-full rounded-sm border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        {...props}
      />
    </div>
  )
);
SearchBox.displayName = "SearchBox";
