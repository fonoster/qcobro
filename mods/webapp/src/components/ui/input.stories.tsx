import type { Meta, StoryObj } from "@storybook/react";
import { Input, InputGroup, SearchBox } from "./input.js";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { placeholder: "Placeholder" } };
export const Filled: Story = { args: { defaultValue: "Value text" } };
export const Disabled: Story = { args: { disabled: true, placeholder: "Disabled" } };

export const WithLabel: StoryObj = {
  render: () => (
    <div className="w-72">
      <InputGroup label="Label Text" placeholder="Placeholder" id="demo" />
    </div>
  )
};

export const WithError: StoryObj = {
  render: () => (
    <div className="w-72">
      <InputGroup
        label="Email"
        placeholder="you@example.com"
        error="Invalid email address"
        id="email"
      />
    </div>
  )
};

export const WithHint: StoryObj = {
  render: () => (
    <div className="w-72">
      <InputGroup
        label="Username"
        placeholder="johndoe"
        hint="Only letters, numbers, and underscores"
        id="username"
      />
    </div>
  )
};

// The `hint` gives way to the `error` while one is set — prefer `placeholder` on any
// field that also carries an `error`.
export const WithHintAndError: StoryObj = {
  render: () => (
    <div className="w-72">
      <InputGroup
        label="Username"
        placeholder="johndoe"
        hint="Only letters, numbers, and underscores"
        error="That username is taken"
        id="username-err"
      />
    </div>
  )
};

export const Search: StoryObj = {
  render: () => (
    <div className="w-72">
      <SearchBox placeholder="Search..." />
    </div>
  )
};

export const SearchFilled: StoryObj = {
  render: () => (
    <div className="w-72">
      <SearchBox defaultValue="Juan Pérez" />
    </div>
  )
};
