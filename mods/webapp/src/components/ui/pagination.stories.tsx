import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Pagination } from "./pagination.js";

const meta = {
  title: "UI/Pagination",
  component: Pagination,
  parameters: { layout: "centered" },
  tags: ["autodocs"]
} satisfies Meta<typeof Pagination>;

export default meta;

export const FewPages: StoryObj = {
  render: () => {
    const [page, setPage] = useState(1);
    return <Pagination page={page} totalPages={5} onPageChange={setPage} />;
  }
};

export const ManyPages: StoryObj = {
  render: () => {
    const [page, setPage] = useState(1);
    return <Pagination page={page} totalPages={20} onPageChange={setPage} />;
  }
};

export const MiddlePage: StoryObj = {
  render: () => {
    const [page, setPage] = useState(8);
    return <Pagination page={page} totalPages={20} onPageChange={setPage} />;
  }
};

export const LastPages: StoryObj = {
  render: () => {
    const [page, setPage] = useState(18);
    return <Pagination page={page} totalPages={20} onPageChange={setPage} />;
  }
};
