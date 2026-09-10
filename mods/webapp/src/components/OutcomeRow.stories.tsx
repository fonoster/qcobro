import type { Meta, StoryObj } from "@storybook/react";
import { OutcomeRow } from "./OutcomeRow.js";

const meta = {
  title: "Components/OutcomeRow",
  component: OutcomeRow,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof OutcomeRow>;

export default meta;

export const PaymentPromise: StoryObj = {
  render: () => (
    <div className="w-[480px]">
      <OutcomeRow
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
      <OutcomeRow
        label="Resultado"
        value="Promesa de pago"
        promise={{ amount: null, dueDate: "23/6/2026", status: "Pendiente" }}
      />
    </div>
  )
};

export const PlainOutcome: StoryObj = {
  render: () => (
    <div className="w-[480px]">
      <OutcomeRow label="Resultado" value="Persona equivocada" />
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
      <p className="mb-2 text-xs text-fg-subtle">Renders nothing when outcome is null:</p>
      <OutcomeRow label="Resultado" value={null} />
    </div>
  )
};

export const AllVariants: StoryObj = {
  render: () => (
    <div className="flex w-[480px] flex-col gap-2">
      <OutcomeRow
        label="Resultado"
        value="Promesa de pago"
        promise={{ amount: "RD$4,820", dueDate: "23/6/2026", status: "Pendiente" }}
      />
      <OutcomeRow label="Resultado" value="Disputa" />
      <OutcomeRow label="Resultado" value="Baja" />
      <OutcomeRow label="Resultado" value="Pagada" />
      <OutcomeRow label="Resultado" value="Devolución solicitada" />
    </div>
  )
};
