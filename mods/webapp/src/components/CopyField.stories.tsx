import type { Meta, StoryObj } from "@storybook/react";
import { I18nProvider } from "../lib/i18n.js";
import { CopyField } from "./CopyField.js";

const meta: Meta<typeof CopyField> = {
  title: "Components/CopyField",
  component: CopyField,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <I18nProvider>
        <div className="w-[420px]">
          <Story />
        </div>
      </I18nProvider>
    )
  ],
  args: {
    value: "WO6ueex0qan9ojhf820wgiae3qi5luy08y"
  }
};

export default meta;
type Story = StoryObj<typeof CopyField>;

export const Field: Story = {
  args: { variant: "field", label: "Workspace ID" }
};

export const FieldNoLabel: Story = {
  args: { variant: "field" }
};

export const Inline: Story = {
  args: {
    variant: "inline",
    className: "max-w-[160px] rounded-md bg-elevated px-2 py-1 hover:bg-elevated"
  }
};

export const InlineInChip: Story = {
  render: (args) => (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2">
      <span className="text-[13px] font-medium text-fg-subtle">Workspace ID</span>
      <CopyField {...args} variant="inline" className="max-w-[120px] text-fg" />
    </div>
  )
};
