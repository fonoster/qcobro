import { forwardRef } from "react";
import { cn } from "@/lib/utils.js";
import { FieldError, FieldLabel, fieldControlClass, fieldErrorClass } from "./field.js";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldControlClass,
        "flex min-h-[80px] px-3 py-2.5 leading-normal",
        invalid && fieldErrorClass,
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export interface TextareaGroupProps extends TextareaProps {
  label?: string;
  error?: string;
  labelEnd?: React.ReactNode;
}

export function TextareaGroup({
  label,
  error,
  labelEnd,
  className,
  id,
  ...props
}: TextareaGroupProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <FieldLabel htmlFor={id} end={labelEnd}>
          {label}
        </FieldLabel>
      )}
      <Textarea id={id} invalid={Boolean(error)} {...props} />
      <FieldError>{error}</FieldError>
    </div>
  );
}
