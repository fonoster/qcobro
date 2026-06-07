import type { Meta, StoryObj } from "@storybook/react";
import { GoogleButton } from "./GoogleButton.js";

const meta: Meta<typeof GoogleButton> = {
  title: "Components/GoogleButton",
  component: GoogleButton,
  args: { className: "w-full", size: "lg" }
};

export default meta;

export const Default: StoryObj<typeof GoogleButton> = {};
