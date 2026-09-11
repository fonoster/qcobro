import { forwardRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils.js";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

/**
 * A label, the field, and — only while something is wrong — an error. Guidance for the
 * operator lives inside the field as its `placeholder`, the way the design system draws it;
 * there is deliberately no explanatory line below the field.
 */
export interface InputGroupProps extends InputProps {
  label?: string;
  error?: string;
}

export function InputGroup({ label, error, className, id, ...props }: InputGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-fg-muted">
          {label}
        </label>
      )}
      <Input id={id} className={error ? "border-danger focus:ring-danger/20" : ""} {...props} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export type SearchBoxProps = React.InputHTMLAttributes<HTMLInputElement>;

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  ({ className, ...props }, ref) => (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
      <input
        ref={ref}
        className="flex h-9 w-full rounded-sm border border-border bg-surface pl-9 pr-3 py-2 text-sm placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
        {...props}
      />
    </div>
  )
);
SearchBox.displayName = "SearchBox";
