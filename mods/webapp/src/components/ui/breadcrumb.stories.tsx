import type { Meta, StoryObj } from "@storybook/react";
import { Breadcrumb } from "./breadcrumb.js";

const meta = {
  title: "UI/Breadcrumb",
  component: Breadcrumb,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Breadcrumb>;

export default meta;

export const Simple: StoryObj = {
  render: () => <Breadcrumb items={[{ label: "Inicio", href: "/" }, { label: "Campañas" }]} />
};

export const Deep: StoryObj = {
  render: () => (
    <Breadcrumb
      items={[
        { label: "Inicio", href: "/" },
        { label: "Carteras", href: "/carteras" },
        { label: "Bancolombia", href: "/carteras/1" },
        { label: "Campaña Q2" }
      ]}
    />
  )
};

export const WithEllipsis: StoryObj = {
  render: () => (
    <Breadcrumb items={[{ label: "Inicio", href: "/" }, { label: "" }, { label: "Campaña Q2" }]} />
  )
};
