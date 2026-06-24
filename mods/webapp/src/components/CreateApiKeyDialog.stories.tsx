import type { Meta, StoryObj } from "@storybook/react";
import { I18nProvider } from "../lib/i18n.js";
import { CreateApiKeyDialog } from "./CreateApiKeyDialog.js";

const meta: Meta<typeof CreateApiKeyDialog> = {
  title: "Components/CreateApiKeyDialog",
  component: CreateApiKeyDialog,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <I18nProvider>
        <Story />
      </I18nProvider>
    )
  ],
  args: {
    open: true,
    onClose: () => {},
    onSubmit: () => {}
  }
};

export default meta;
type Story = StoryObj<typeof CreateApiKeyDialog>;

export const Default: Story = {};

export const Pending: Story = { args: { isPending: true } };

export const WithError: Story = { args: { error: "Could not create the key." } };
