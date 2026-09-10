import { forwardRef } from "react";
import { cn } from "@/lib/utils.js";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export interface TextareaGroupProps extends TextareaProps {
  label?: string;
  hint?: string;
  error?: string;
}

export function TextareaGroup({ label, hint, error, className, id, ...props }: TextareaGroupProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-fg-muted">
          {label}
        </label>
      )}
      <Textarea id={id} {...props} />
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}
