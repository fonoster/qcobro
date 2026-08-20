import type { Meta, StoryObj } from "@storybook/react";
import { ResultadoRow } from "./ResultadoRow.js";

const meta = {
  title: "Components/ResultadoRow",
  component: ResultadoRow,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof ResultadoRow>;

export default meta;

export const PaymentPromise: StoryObj = {
  render: () => (
    <div className="w-[480px]">
      <ResultadoRow
        label="Resultado"
        value="Promesa de pago"
        promise={{ amount: "RD$4,820", dueDate: "23/6/2026", status: "Pendiente" }}
      />
    </div>
  )
};

/** A promise captured without an amount still shows its due date. */
export const PaymentPromiseWithoutAmount: StoryObj = {
  render: () => (
    <div className="w-[480px]">
      <ResultadoRow
        label="Resultado"
        value="Promesa de pago"
        promise={{ amount: null, dueDate: "23/6/2026", status: "Pendiente" }}
      />
    </div>
  )
};

export const PlainResultado: StoryObj = {
  render: () => (
    <div className="w-[480px]">
      <ResultadoRow label="Resultado" value="Persona equivocada" />
    </div>
  )
};

/**
 * The common case. An interaction that produced nothing renders no row — an empty one would
 * read as missing data rather than as a real answer.
 */
export const Empty: StoryObj = {
  render: () => (
    <div className="w-[480px]">
      <p className="mb-2 text-xs text-slate-400">Renders nothing when resultado is null:</p>
      <ResultadoRow label="Resultado" value={null} />
    </div>
  )
};

export const AllVariants: StoryObj = {
  render: () => (
    <div className="flex w-[480px] flex-col gap-2">
      <ResultadoRow
        label="Resultado"
        value="Promesa de pago"
        promise={{ amount: "RD$4,820", dueDate: "23/6/2026", status: "Pendiente" }}
      />
      <ResultadoRow label="Resultado" value="Disputa" />
      <ResultadoRow label="Resultado" value="Baja" />
      <ResultadoRow label="Resultado" value="Pagada" />
      <ResultadoRow label="Resultado" value="Devolución solicitada" />
    </div>
  )
};
