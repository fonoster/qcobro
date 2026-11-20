import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils.js";

/**
 * Field styling shared by Input, Select and Textarea: 40 px tall, --background fill, input
 * border, and on focus a 1.5 px foreground stroke (never green). `fieldErrorClass` swaps
 * the border to danger while the field has an error.
 */
export const fieldControlClass =
  "w-full rounded-control border border-input bg-bg text-sm text-fg placeholder:text-fg-subtle outline-none transition-[border-color,box-shadow] focus:border-fg focus:shadow-[0_0_0_0.5px_var(--color-fg)] disabled:cursor-not-allowed disabled:opacity-50";
export const fieldErrorClass =
  "border-danger focus:border-danger focus:shadow-[0_0_0_0.5px_var(--color-danger)]";

/** A field label: 12/500 foreground. `end` is muted text at the label row's right end. */
export function FieldLabel({
  className,
  children,
  end,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { end?: ReactNode }) {
  const label = (
    <label className={cn("text-xs font-medium text-fg", className)} {...props}>
      {children}
    </label>
  );
  if (!end) return label;
  return (
    <div className="flex items-center justify-between gap-2">
      {label}
      <span className="text-xs text-fg-muted">{end}</span>
    </div>
  );
}

/** The inline error under a field. */
export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="text-xs text-danger">
      {children}
    </p>
  );
}

/**
 * A label, any control, and an error only while something is wrong. Use it for controls
 * without their own *Group (choice cards, the day picker, a custom picker).
 *
 * @example <Field label="Días" error={err}><DayPicker value={days} onChange={setDays} /></Field>
 */
export function Field({
  label,
  htmlFor,
  end,
  error,
  className,
  children
}: {
  label?: ReactNode;
  htmlFor?: string;
  end?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <FieldLabel htmlFor={htmlFor} end={end}>
          {label}
        </FieldLabel>
      )}
      {children}
      <FieldError>{error}</FieldError>
    </div>
  );
}
