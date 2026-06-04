import type { Meta, StoryObj } from "@storybook/react";
import { Textarea, TextareaGroup } from "./textarea.js";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Textarea>;

export default meta;

export const Default: StoryObj = { render: () => <Textarea placeholder="Enter text..." className="w-80" /> };
export const Filled: StoryObj = { render: () => <Textarea defaultValue="Some content here" className="w-80" /> };
export const WithLabel: StoryObj = {
  render: () => (
    <div className="w-80">
      <TextareaGroup label="Notas" placeholder="Agregar notas sobre la gestión..." id="notas" />
    </div>
  )
};
