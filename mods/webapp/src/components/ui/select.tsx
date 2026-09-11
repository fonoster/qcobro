import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils.js";

export function FilterSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative inline-flex">
      <select
        className={cn(
          "h-9 cursor-pointer appearance-none rounded-lg border border-border bg-surface px-3 pr-8 text-sm text-fg-muted outline-none focus:border-primary focus:ring-2 focus:ring-ring/20",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
    </div>
  );
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full cursor-pointer appearance-none rounded-sm border border-border bg-surface px-3 py-2 pr-8 text-sm text-fg focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
    </div>
  )
);
Select.displayName = "Select";

export interface SelectGroupProps extends SelectProps {
  label?: string;
  error?: string;
}

export function SelectGroup({ label, error, className, id, children, ...props }: SelectGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-fg-muted">
          {label}
        </label>
      )}
      <Select id={id} {...props}>
        {children}
      </Select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
