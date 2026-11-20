import { forwardRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { FieldError, FieldLabel, fieldControlClass, fieldErrorClass } from "./field.js";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Shows the danger border. */
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(fieldControlClass, "flex h-10 px-3", invalid && fieldErrorClass, className)}
      {...props}
    />
  )
);
Input.displayName = "Input";

/**
 * A label, the field, and — only while something is wrong — an error. Guidance for the
 * operator lives inside the field as its `placeholder`, the way the design system draws it;
 * there is deliberately no explanatory line below the field. State rules in the label.
 */
export interface InputGroupProps extends InputProps {
  label?: string;
  error?: string;
  /** Muted text at the label row's right end. */
  labelEnd?: React.ReactNode;
}

export function InputGroup({ label, error, labelEnd, className, id, ...props }: InputGroupProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <FieldLabel htmlFor={id} end={labelEnd}>
          {label}
        </FieldLabel>
      )}
      <Input id={id} invalid={Boolean(error)} {...props} />
      <FieldError>{error}</FieldError>
    </div>
  );
}

export type SearchBoxProps = React.InputHTMLAttributes<HTMLInputElement>;

/** The toolbar search: 38 px, card fill, search icon. */
export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  ({ className, ...props }, ref) => (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
      <input
        ref={ref}
        className={cn(fieldControlClass, "flex h-[38px] bg-surface pl-9 pr-3 border-border")}
        {...props}
      />
    </div>
  )
);
SearchBox.displayName = "SearchBox";
