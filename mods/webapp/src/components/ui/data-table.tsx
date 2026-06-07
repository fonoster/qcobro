import { cn } from "@/lib/utils.js";
import { SearchBox } from "./input.js";
import { Button } from "./button.js";
import { Pagination } from "./pagination.js";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  searchable?: boolean;
  searchPlaceholder?: string;
  actionLabel?: string;
  onAction?: () => void;
  onRowClick?: (row: T) => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  totalRecords?: number;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  searchable = true,
  searchPlaceholder = "Buscar...",
  actionLabel,
  onAction,
  onRowClick,
  page = 1,
  totalPages = 1,
  onPageChange,
  totalRecords,
  className
}: DataTableProps<T>) {
  const pageStart =
    totalRecords !== undefined ? (page - 1) * Math.ceil(totalRecords / totalPages || 1) + 1 : 1;
  const pageEnd =
    totalRecords !== undefined
      ? Math.min(page * Math.ceil(totalRecords / totalPages || 1), totalRecords)
      : data.length;

  return (
    <div className={cn("overflow-hidden border border-slate-200 bg-white", className)}>
      {(searchable || actionLabel) && (
        <div className="flex items-center justify-between px-4 py-3">
          {searchable && <SearchBox placeholder={searchPlaceholder} className="w-60" />}
          {!searchable && <div />}
          {actionLabel && <Button onClick={onAction}>+ {actionLabel}</Button>}
        </div>
      )}

      <table className="w-full">
        <thead>
          <tr className="h-11 border-b border-slate-200 bg-white">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  "px-4 text-left text-[13px] font-semibold text-slate-500",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm text-slate-400"
              >
                Sin resultados.
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={String(keyField ? row[keyField] : i)}
                className="h-[52px] border-b border-slate-200 last:border-b-0 transition-colors hover:bg-slate-50 cursor-pointer"
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={String(col.key)}
                    className={cn(
                      "px-4 text-sm text-slate-900",
                      colIdx === 0 && "font-medium",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.className
                    )}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {(totalPages > 1 || totalRecords !== undefined) && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <span className="text-[13px] text-slate-500">
            {totalRecords !== undefined
              ? `Mostrando ${pageStart}–${pageEnd} de ${totalRecords} resultados`
              : `${data.length} resultados`}
          </span>
          {totalPages > 1 && onPageChange && (
            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
          )}
        </div>
      )}
    </div>
  );
}
