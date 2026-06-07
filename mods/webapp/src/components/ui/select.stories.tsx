import type { Meta, StoryObj } from "@storybook/react";
import { Select, SelectGroup } from "./select.js";

const meta = {
  title: "UI/Select",
  component: Select,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-56">
      <Select>
        <option value="">Select an option</option>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
      </Select>
    </div>
  )
};

export const WithLabel: StoryObj = {
  render: () => (
    <div className="w-56">
      <SelectGroup label="Estado" id="estado">
        <option value="">Todos</option>
        <option value="activo">Activo</option>
        <option value="cerrado">Cerrado</option>
      </SelectGroup>
    </div>
  )
};

export const WithError: StoryObj = {
  render: () => (
    <div className="w-56">
      <SelectGroup label="Estado" error="Campo requerido" id="estado-err">
        <option value="">Seleccionar</option>
      </SelectGroup>
    </div>
  )
};
