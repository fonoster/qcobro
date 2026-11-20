import { forwardRef } from "react";
import { ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { FieldError, FieldLabel, fieldControlClass, fieldErrorClass } from "./field.js";

/** A compact select for toolbars. Prefer FilterChip for list filters. */
export function FilterSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative inline-flex">
      <select
        className={cn(
          fieldControlClass,
          "h-[38px] w-auto cursor-pointer appearance-none border-border bg-surface px-3 pr-8",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
    </div>
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  /** A leading icon inside the control (e.g. a Bot or Calendar lucide icon). */
  icon?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, invalid, icon, ...props }, ref) => (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-fg-muted [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
      )}
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldControlClass,
          "flex h-10 cursor-pointer appearance-none px-3 pr-9",
          icon && "pl-9",
          invalid && fieldErrorClass,
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
    </div>
  )
);
Select.displayName = "Select";

export interface SelectGroupProps extends SelectProps {
  label?: string;
  error?: string;
  labelEnd?: React.ReactNode;
}

export function SelectGroup({
  label,
  error,
  labelEnd,
  className,
  id,
  children,
  ...props
}: SelectGroupProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <FieldLabel htmlFor={id} end={labelEnd}>
          {label}
        </FieldLabel>
      )}
      <Select id={id} invalid={Boolean(error)} {...props}>
        {children}
      </Select>
      <FieldError>{error}</FieldError>
    </div>
  );
}
