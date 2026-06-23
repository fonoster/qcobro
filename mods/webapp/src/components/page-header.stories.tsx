import type { Meta, StoryObj } from "@storybook/react";
import { Plus } from "lucide-react";
import { PageHeader } from "./page-header.js";
import { Button } from "./ui/button.js";

const meta = {
  title: "Components/PageHeader",
  component: PageHeader,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof PageHeader>;

export default meta;

export const Default: StoryObj = {
  render: () => <PageHeader title="Carteras" description="Gestión de portafolios de crédito" />
};

export const WithAction: StoryObj = {
  render: () => (
    <PageHeader
      title="Campañas"
      description="Campañas de cobranza activas e históricas"
      action={
        <Button>
          <Plus className="h-4 w-4" />
          Nueva campaña
        </Button>
      }
    />
  )
};

export const TitleOnly: StoryObj = {
  render: () => <PageHeader title="Rendimiento" />
};
