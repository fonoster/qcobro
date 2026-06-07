import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch.js";

const meta = {
  title: "UI/Switch",
  component: Switch,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Switch>;

export default meta;

export const Default: StoryObj = { render: () => <Switch label="Activar agente" id="sw1" /> };
export const Checked: StoryObj = {
  render: () => <Switch label="Activar agente" id="sw2" defaultChecked />
};
export const NoLabel: StoryObj = { render: () => <Switch id="sw3" /> };
