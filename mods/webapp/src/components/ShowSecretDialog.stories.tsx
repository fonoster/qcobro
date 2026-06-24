import type { Meta, StoryObj } from "@storybook/react";
import { I18nProvider } from "../lib/i18n.js";
import { ShowSecretDialog } from "./ShowSecretDialog.js";

const meta: Meta<typeof ShowSecretDialog> = {
  title: "Components/ShowSecretDialog",
  component: ShowSecretDialog,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <I18nProvider>
        <Story />
      </I18nProvider>
    )
  ],
  args: {
    credentials: {
      accessKeyId: "ak_9f3a1c7e2b4d8f60",
      accessKeySecret: "sk_qco_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    },
    onClose: () => {}
  }
};

export default meta;
type Story = StoryObj<typeof ShowSecretDialog>;

export const Default: Story = {};

export const Hidden: Story = { args: { credentials: null } };
