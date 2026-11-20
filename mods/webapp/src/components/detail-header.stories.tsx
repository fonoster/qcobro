import type { Meta, StoryObj } from "@storybook/react";
import { Megaphone } from "lucide-react";
import { DetailHeader } from "./detail-header.js";
import { PageHeader } from "./page-header.js";
import { Breadcrumb } from "./ui/breadcrumb.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";

const meta = {
  title: "Components/DetailHeader",
  component: DetailHeader,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof DetailHeader>;

export default meta;

export const Campaign: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Breadcrumb items={[{ label: "Campañas", href: "/campaigns" }, { label: "Mora 8–30" }]} />
      <DetailHeader
        icon={<Megaphone />}
        title="Mora 8–30"
        badge={<Badge>Activa</Badge>}
        meta="Voz IA · Carla"
        actions={
          <>
            <Button variant="outline">Editar</Button>
            <Button variant="secondary">Pausar</Button>
          </>
        }
      />
    </div>
  )
};

export const ListHeader: StoryObj = {
  render: () => (
    <PageHeader
      title="Carteras"
      description="Las cuentas de cada cliente, sincronizadas desde su CSV."
      actions={<Button>Nueva cartera</Button>}
    />
  )
};
