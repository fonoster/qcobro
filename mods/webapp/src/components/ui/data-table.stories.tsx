import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DataTable, TableCellStack } from "./data-table.js";
import { Badge } from "./badge.js";
import { Button } from "./button.js";
import { EmptyState } from "./empty-state.js";
import { FilterChip } from "./filter-chip.js";
import { FolderOpen, Plus } from "lucide-react";

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
  {
    id: "1",
    name: "Carlos Ruiz",
    accountId: "ACC-001",
    balance: "$1,200",
    status: "Current",
    daysPastDue: 0
  },
  {
    id: "2",
    name: "Ana Gómez",
    accountId: "ACC-002",
    balance: "$450",
    status: "Past Due",
    daysPastDue: 45
  },
  {
    id: "3",
    name: "Luis Torres",
    accountId: "ACC-003",
    balance: "$2,100",
    status: "Critical",
    daysPastDue: 120
  },
  {
    id: "4",
    name: "María Silva",
    accountId: "ACC-004",
    balance: "$780",
    status: "Past Due",
    daysPastDue: 30
  },
  {
    id: "5",
    name: "Pedro Castro",
    accountId: "ACC-005",
    balance: "$330",
    status: "Current",
    daysPastDue: 0
  }
];

const statusVariant: Record<string, "secondary" | "destructive"> = {
  Current: "secondary",
  "Past Due": "secondary",
  Critical: "destructive"
};

const columns = [
  { key: "name", header: "Name" },
  { key: "accountId", header: "Account ID" },
  { key: "balance", header: "Balance", align: "right" as const },
  {
    key: "status",
    header: "Status",
    render: (row: Account) => (
      <Badge variant={statusVariant[row.status] ?? "secondary"}>{row.status}</Badge>
    )
  },
  { key: "daysPastDue", header: "Days Past Due", align: "right" as const }
] as const;

export const Default: StoryObj = {
  render: () => (
    <DataTable data={accounts} keyField="id" columns={[...columns]} searchable={false} />
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
        searchable={false}
        page={page}
        totalPages={8}
        totalRecords={40}
        onPageChange={setPage}
      />
    );
  }
};

export const WithToolbar: StoryObj = {
  name: "Search + filter chip + count, 60 px rows",
  render: () => {
    const [status, setStatus] = useState("");
    const rows = status ? accounts.filter((a) => a.status === status) : accounts;
    return (
      <DataTable
        data={rows}
        keyField="id"
        columns={[
          { key: "name", header: "Cuenta" },
          { key: "accountId", header: "ID", mono: true },
          { key: "balance", header: "Saldo", mono: true, width: 140 },
          { key: "daysPastDue", header: "Días", mono: true, width: 80 }
        ]}
        searchable
        searchPlaceholder="Buscar cuentas"
        rowHeight={60}
        countLabel="cuentas"
        filters={
          <FilterChip
            label="Estado"
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: "Todos" },
              { value: "Current", label: "Al día" },
              { value: "Past Due", label: "Vencida" },
              { value: "Critical", label: "Crítica" }
            ]}
          />
        }
      />
    );
  }
};

export const TwoLineCell: StoryObj = {
  name: "Two-line primary cell",
  render: () => (
    <DataTable
      data={accounts}
      keyField="id"
      searchable={false}
      columns={[
        {
          key: "name",
          header: "Debtor",
          render: (r: Account) => <TableCellStack title={r.name} sub={r.accountId} />
        },
        { key: "balance", header: "Balance", align: "right" },
        {
          key: "status",
          header: "Status",
          render: (r: Account) => (
            <Badge variant={statusVariant[r.status] ?? "secondary"}>{r.status}</Badge>
          )
        }
      ]}
    />
  )
};

export const Selectable: StoryObj = {
  name: "Selectable (bulk bar)",
  render: () => {
    const [selected, setSelected] = useState<string[]>(["1", "2"]);
    return (
      <DataTable
        data={accounts}
        keyField="id"
        searchable={false}
        selectable
        getRowId={(r) => r.id as string}
        selectedIds={selected}
        onSelectionChange={setSelected}
        bulkActions={
          <Button variant="outline" onClick={() => alert(`Contact ${selected.length}`)}>
            Contact selected
          </Button>
        }
        columns={[
          {
            key: "name",
            header: "Debtor",
            render: (r: Account) => <TableCellStack title={r.name} sub={r.accountId} />
          },
          { key: "balance", header: "Balance", align: "right" },
          {
            key: "status",
            header: "Status",
            render: (r: Account) => (
              <Badge variant={statusVariant[r.status] ?? "secondary"}>{r.status}</Badge>
            )
          }
        ]}
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
      searchable={false}
      empty={
        <EmptyState
          icon={<FolderOpen />}
          title="Todavía no tienes carteras"
          body="Crea una cartera por cliente y sincroniza sus cuentas desde un CSV."
          action={
            <Button>
              <Plus className="h-4 w-4" />
              Nueva cartera
            </Button>
          }
        />
      }
    />
  )
};
