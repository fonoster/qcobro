import type { Meta, StoryObj } from "@storybook/react";
import { Radio } from "./radio.js";

const meta = {
  title: "UI/Radio",
  component: Radio,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Radio>;

export default meta;

export const Default: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Radio label="Agresivo" name="strategy" id="r1" value="agresivo" />
      <Radio label="Moderado" name="strategy" id="r2" value="moderado" defaultChecked />
      <Radio label="Suave" name="strategy" id="r3" value="suave" />
    </div>
  )
};

export const WithDescription: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Radio
        label="Agresivo"
        description="Contacto diario, múltiples canales"
        name="s2"
        id="s2-1"
        value="a"
      />
      <Radio
        label="Moderado"
        description="Contacto 3 veces por semana"
        name="s2"
        id="s2-2"
        value="m"
        defaultChecked
      />
      <Radio
        label="Suave"
        description="Contacto semanal, tono amigable"
        name="s2"
        id="s2-3"
        value="s"
      />
    </div>
  )
};
