import type { Meta, StoryObj } from "@storybook/react";
import { Tabs } from "./tabs.js";

const meta = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Tabs>;

export default meta;

export const Default: StoryObj = {
  render: () => (
    <div className="w-96">
      <Tabs
        items={[
          { id: "activas", label: "Activas" },
          { id: "cerradas", label: "Cerradas" },
          { id: "pausadas", label: "Pausadas" }
        ]}
      />
    </div>
  )
};

export const WithContent: StoryObj = {
  render: () => (
    <div className="w-96">
      <Tabs
        items={[
          {
            id: "resumen",
            label: "Resumen",
            content: <p className="text-sm text-gray-600">Aquí va el resumen de la cartera.</p>
          },
          {
            id: "gestiones",
            label: "Gestiones",
            content: <p className="text-sm text-gray-600">Lista de gestiones realizadas.</p>
          },
          {
            id: "promesas",
            label: "Promesas",
            content: <p className="text-sm text-gray-600">Promesas de pago registradas.</p>
          }
        ]}
        defaultTab="resumen"
      />
    </div>
  )
};
