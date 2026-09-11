import type { Meta, StoryObj } from "@storybook/react";
import { Textarea, TextareaGroup } from "./textarea.js";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Textarea>;

export default meta;

export const Default: StoryObj = {
  render: () => <Textarea placeholder="Enter text..." className="w-80" />
};
export const Filled: StoryObj = {
  render: () => <Textarea defaultValue="Some content here" className="w-80" />
};
export const WithLabel: StoryObj = {
  render: () => (
    <div className="w-80">
      <TextareaGroup label="Notas" placeholder="Agregar notas sobre la gestión..." id="notas" />
    </div>
  )
};
// Guidance lives inside the field. The example carries a `{{variable}}` so the operator
// can see that templating is available.
export const WithExample: StoryObj = {
  render: () => (
    <div className="w-80">
      <TextareaGroup
        label="Guion"
        placeholder="Hola {{firstName}}, le recordamos que su cuenta presenta un saldo pendiente."
        id="guion"
      />
    </div>
  )
};
export const WithError: StoryObj = {
  render: () => (
    <div className="w-80">
      <TextareaGroup
        label="Guion"
        placeholder="Hola {{firstName}}, le recordamos que su cuenta presenta un saldo pendiente."
        error="El guion es obligatorio."
        id="guion-err"
      />
    </div>
  )
};
