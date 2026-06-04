import type { Meta, StoryObj } from "@storybook/react";
import { SectionCard } from "./section-card.js";
import { Button } from "./ui/button.js";

const meta = {
  title: "Components/SectionCard",
  component: SectionCard,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof SectionCard>;

export default meta;

export const Default: StoryObj = {
  render: () => (
    <SectionCard title="Últimas gestiones">
      <p className="text-sm text-gray-600">No hay gestiones recientes.</p>
    </SectionCard>
  )
};

export const WithDescription: StoryObj = {
  render: () => (
    <SectionCard
      title="Promesas de pago"
      description="Compromisos vigentes esta semana"
    >
      <p className="text-sm text-gray-600">3 promesas por vencer hoy.</p>
    </SectionCard>
  )
};

export const WithAction: StoryObj = {
  render: () => (
    <SectionCard
      title="Agentes activos"
      description="Estado en tiempo real"
      action={<Button size="sm" variant="outline">Ver todos</Button>}
    >
      <p className="text-sm text-gray-600">12 de 15 agentes en línea.</p>
    </SectionCard>
  )
};

export const NoHeader: StoryObj = {
  render: () => (
    <SectionCard>
      <p className="text-sm text-gray-600">Contenido sin encabezado.</p>
    </SectionCard>
  )
};
