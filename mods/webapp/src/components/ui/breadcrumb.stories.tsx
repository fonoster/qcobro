import type { Meta, StoryObj } from "@storybook/react";
import { Breadcrumb } from "./breadcrumb.js";

const meta = {
  title: "UI/Breadcrumb",
  component: Breadcrumb,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Breadcrumb>;

export default meta;

export const Detail: StoryObj = {
  render: () => (
    <Breadcrumb items={[{ label: "Agentes IA", href: "/agents" }, { label: "Carla" }]} />
  )
};

export const Deep: StoryObj = {
  render: () => (
    <Breadcrumb
      items={[
        { label: "Campañas", href: "/campaigns" },
        { label: "Mora 8–30", href: "/campaigns/1" },
        { label: "Editar" }
      ]}
    />
  )
};
