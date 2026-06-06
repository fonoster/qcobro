import type { Meta, StoryObj } from "@storybook/react";
import { I18nProvider } from "../lib/i18n.js";
import { LanguageSwitcher } from "./LanguageSwitcher.js";

const meta: Meta<typeof LanguageSwitcher> = {
  title: "Components/LanguageSwitcher",
  component: LanguageSwitcher,
  decorators: [
    (Story) => (
      <I18nProvider>
        <Story />
      </I18nProvider>
    )
  ]
};

export default meta;
type Story = StoryObj<typeof LanguageSwitcher>;

export const Default: Story = {};
