import type { Meta, StoryObj } from "@storybook/react";
import { Avatar } from "./avatar.js";

const meta = {
  title: "UI/Avatar",
  component: Avatar,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Avatar>;

export default meta;

export const Initials: StoryObj = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar name="Carlos Ruiz" size="sm" />
      <Avatar name="Carlos Ruiz" size="md" />
      <Avatar name="Carlos Ruiz" size="lg" />
    </div>
  )
};

export const SingleName: StoryObj = { render: () => <Avatar name="Ana" /> };

export const WithImage: StoryObj = {
  render: () => <Avatar src="https://i.pravatar.cc/150?img=32" name="User" size="lg" />
};

export const AllSizes: StoryObj = {
  render: () => (
    <div className="flex items-end gap-4">
      <Avatar name="Pedro Sanders" size="sm" />
      <Avatar name="Pedro Sanders" size="md" />
      <Avatar name="Pedro Sanders" size="lg" />
    </div>
  )
};
