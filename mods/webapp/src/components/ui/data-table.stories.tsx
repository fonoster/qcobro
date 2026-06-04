import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DataTable } from "./data-table.js";
import { Badge } from "./badge.js";

const meta = {
  title: "UI/DataTable",
  component: DataTable,
  parameters: { layout: "padded" },
  tags: ["autodocs"]
} satisfies Meta<typeof DataTable>;

export default meta;

type Account = {
  id: string;
  name: string;
  accountId: string;
  balance: string;
  status: string;
  daysPastDue: number;
};

const accounts: Account[] = [
  { id: "1", name: "Carlos Ruiz", accountId: "ACC-001", balance: "$1,200", status: "Current", daysPastDue: 0 },
  { id: "2", name: "Ana Gómez", accountId: "ACC-002", balance: "$450", status: "Past Due", daysPastDue: 45 },
  { id: "3", name: "Luis Torres", accountId: "ACC-003", balance: "$2,100", status: "Critical", daysPastDue: 120 },
  { id: "4", name: "María Silva", accountId: "ACC-004", balance: "$780", status: "Past Due", daysPastDue: 30 },
  { id: "5", name: "Pedro Castro", accountId: "ACC-005", balance: "$330", status: "Current", daysPastDue: 0 }
];

const statusVariant: Record<string, "success" | "destructive" | "orange"> = {
  Current: "success",
  "Past Due": "orange",
  Critical: "destructive"
};

const columns = [
  { key: "name", header: "Name" },
  { key: "accountId", header: "Account ID" },
  { key: "balance", header: "Balance" },
  {
    key: "status",
    header: "Status",
    render: (row: Account) => (
      <Badge variant={statusVariant[row.status] ?? "secondary"}>{row.status}</Badge>
    )
  },
  { key: "daysPastDue", header: "Days Past Due" }
] as const;

export const WithoutPagination: StoryObj = {
  name: "Without Pagination",
  render: () => (
    <DataTable
      data={accounts}
      keyField="id"
      columns={[...columns]}
    />
  )
};

export const WithPagination: StoryObj = {
  name: "With Pagination",
  render: () => {
    const [page, setPage] = useState(1);
    return (
      <DataTable
        data={accounts}
        keyField="id"
        columns={[...columns]}
        page={page}
        totalPages={8}
        totalRecords={40}
        onPageChange={setPage}
      />
    );
  }
};

export const WithAction: StoryObj = {
  name: "With Action Button",
  render: () => (
    <DataTable
      data={accounts}
      keyField="id"
      columns={[
        { key: "name", header: "Name" },
        { key: "balance", header: "Balance" },
        {
          key: "status",
          header: "Status",
          render: (row: Account) => (
            <Badge variant={statusVariant[row.status] ?? "secondary"}>{row.status}</Badge>
          )
        }
      ]}
      actionLabel="New account"
      onAction={() => alert("New account")}
    />
  )
};

export const WithSearchAndPagination: StoryObj = {
  name: "With Search + Pagination",
  render: () => {
    const [page, setPage] = useState(1);
    return (
      <DataTable
        data={accounts}
        keyField="id"
        columns={[...columns]}
        searchable
        searchPlaceholder="Buscar cuentas…"
        actionLabel="Nueva cuenta"
        page={page}
        totalPages={5}
        totalRecords={25}
        onPageChange={setPage}
      />
    );
  }
};

export const Empty: StoryObj = {
  name: "Empty State",
  render: () => (
    <DataTable
      data={[]}
      keyField="id"
      columns={[...columns]}
      actionLabel="New account"
    />
  )
};
