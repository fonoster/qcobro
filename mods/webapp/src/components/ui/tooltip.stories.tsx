import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip } from "./tooltip.js";
import { Button } from "./button.js";
import { Info } from "lucide-react";

const meta = {
  title: "UI/Tooltip",
  component: Tooltip,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Tooltip>;

export default meta;

export const Top: StoryObj = {
  render: () => (
    <Tooltip content="Ver detalles del deudor" side="top">
      <Button variant="outline">Hover aquí</Button>
    </Tooltip>
  )
};

export const Bottom: StoryObj = {
  render: () => (
    <Tooltip content="Exportar como CSV" side="bottom">
      <Button variant="outline">Hover aquí</Button>
    </Tooltip>
  )
};

export const Left: StoryObj = {
  render: () => (
    <Tooltip content="Acción rápida" side="left">
      <Button variant="outline">Hover aquí</Button>
    </Tooltip>
  )
};

export const Right: StoryObj = {
  render: () => (
    <Tooltip content="Más información" side="right">
      <Button variant="ghost">
        <Info className="h-4 w-4" />
      </Button>
    </Tooltip>
  )
};

export const AllSides: StoryObj = {
  render: () => (
    <div className="flex items-center gap-8">
      <Tooltip content="Arriba" side="top">
        <Button size="sm" variant="outline">Top</Button>
      </Tooltip>
      <Tooltip content="Abajo" side="bottom">
        <Button size="sm" variant="outline">Bottom</Button>
      </Tooltip>
      <Tooltip content="Izquierda" side="left">
        <Button size="sm" variant="outline">Left</Button>
      </Tooltip>
      <Tooltip content="Derecha" side="right">
        <Button size="sm" variant="outline">Right</Button>
      </Tooltip>
    </div>
  )
};
