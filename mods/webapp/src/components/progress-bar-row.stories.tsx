import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBarRow } from "./progress-bar-row.js";

const meta = {
  title: "Components/ProgressBarRow",
  component: ProgressBarRow,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof ProgressBarRow>;

export default meta;

export const Default: StoryObj = {
  render: () => <ProgressBarRow label="Tasa de contacto" value={68} className="w-96" />
};

export const WithDisplayValue: StoryObj = {
  render: () => (
    <ProgressBarRow
      label="Recaudo"
      value={4200000}
      max={5000000}
      displayValue="$4.2M"
      className="w-96"
    />
  )
};

export const Multiple: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-3 w-[480px]">
      <ProgressBarRow label="Llamadas" value={82} />
      <ProgressBarRow label="SMS" value={54} />
      <ProgressBarRow label="WhatsApp" value={71} />
      <ProgressBarRow label="Email" value={33} />
      <ProgressBarRow label="Visita" value={12} />
    </div>
  )
};

export const LowValue: StoryObj = {
  render: () => <ProgressBarRow label="Meta cumplida" value={8} className="w-96" />
};
