export interface ResultadoRowProps {
  /** Localized label, e.g. "Resultado". */
  label: string;
  /** Localized resultado, e.g. "Promesa de pago". Null renders nothing at all. */
  value: string | null;
  /** Linked promise, when the resultado is a payment commitment. */
  promise?: { amount: string | null; dueDate: string } | null;
}

/**
 * What came of the interaction, as a standalone row.
 *
 * Deliberately **not** nested inside the AI-insights section: it used to be, which meant a
 * gestión with no AI summary showed no result at all. It is also the only rendering of a
 * linked payment promise — the promise does not get a second card of its own, which is what
 * the design has always shown and what the build had drifted from.
 *
 * Renders nothing when `value` is null. That is the common case: most interactions produce no
 * outcome, and an empty row would imply missing data rather than a real answer.
 */
export function ResultadoRow({ label, value, promise }: ResultadoRowProps) {
  if (!value) return null;
  const detail = promise
    ? `${promise.amount ? `${promise.amount} · ` : ""}${promise.dueDate}`
    : null;
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-700">
        {value}
        {detail ? ` · ${detail}` : ""}
      </span>
    </div>
  );
}
