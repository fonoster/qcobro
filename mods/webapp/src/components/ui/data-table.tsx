import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { useI18n } from "@/lib/i18n.js";
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
  filterElement?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onRowClick?: (row: T) => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  totalRecords?: number;
  className?: string;
  /** Enables the leading checkbox column (the "richer control" variant). */
  selectable?: boolean;
  /** Stable id per row for selection. Falls back to `keyField`. Required when `selectable`. */
  getRowId?: (row: T) => string;
  /** Controlled selection. */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Action nodes shown in the toolbar's selection bar while rows are selected. */
  bulkActions?: React.ReactNode;
}

/** Two-line cell for a table's primary column (e.g. name + sub-identifier). */
export function TableCellStack({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-slate-900">{title}</span>
      {sub != null && sub !== "" && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  searchable = true,
  searchPlaceholder,
  filterElement,
  actionLabel,
  onAction,
  onRowClick,
  page = 1,
  totalPages = 1,
  onPageChange,
  totalRecords,
  className,
  selectable = false,
  getRowId,
  selectedIds,
  onSelectionChange,
  bulkActions
}: DataTableProps<T>) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [internalSelected, setInternalSelected] = useState<string[]>([]);

  const selected = selectedIds ?? internalSelected;
  const setSelected = (ids: string[]) => {
    onSelectionChange?.(ids);
    if (selectedIds === undefined) setInternalSelected(ids);
  };

  const rowId = (row: T, index: number): string =>
    getRowId ? getRowId(row) : keyField ? String(row[keyField]) : String(index);

  const displayData =
    searchable && searchQuery
      ? data.filter((row) =>
          Object.values(row).some((val) =>
            String(val ?? "")
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
          )
        )
      : data;

  const visibleIds = displayData.map((row, i) => rowId(row, i));
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const someSelected = visibleIds.some((id) => selected.includes(id));

  function toggleAll() {
    setSelected(allSelected ? [] : visibleIds);
  }

  function toggleRow(id: string) {
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const pageStart =
    totalRecords !== undefined ? (page - 1) * Math.ceil(totalRecords / totalPages || 1) + 1 : 1;
  const pageEnd =
    totalRecords !== undefined
      ? Math.min(page * Math.ceil(totalRecords / totalPages || 1), totalRecords)
      : displayData.length;

  const rowCountLabel = t("table.rowCount")
    .replace("{start}", String(pageStart))
    .replace("{end}", String(pageEnd))
    .replace("{total}", String(totalRecords ?? displayData.length));

  const colSpan = columns.length + (selectable ? 1 : 0);
  const hasToolbar = searchable || actionLabel || filterElement;
  const showSelectionBar = selectable && selected.length > 0;

  const checkboxClass =
    "h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-500 accent-emerald-500 focus:ring-emerald-500";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {(hasToolbar || showSelectionBar) && (
        <div className="flex min-h-9 items-center justify-between gap-3">
          {showSelectionBar ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">
                  {t("table.selected").replace("{count}", String(selected.length))}
                </span>
                {bulkActions}
              </div>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="flex cursor-pointer items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
                {t("common.cancel")}
              </button>
            </>
          ) : (
            <>
              {filterElement ??
                (searchable ? (
                  <SearchBox
                    placeholder={searchPlaceholder ?? t("table.searchPlaceholder")}
                    className="w-60"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                ) : (
                  <div />
                ))}
              {actionLabel && (
                <Button onClick={onAction}>
                  <Plus className="h-4 w-4" />
                  {actionLabel}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="h-11 border-b border-slate-200 bg-slate-50">
              {selectable && (
                <th className="w-12 px-0 text-center">
                  <input
                    type="checkbox"
                    aria-label={t("table.selectAll")}
                    className={checkboxClass}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    "px-4 text-left text-[12px] font-semibold tracking-[0.3px] text-slate-500",
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
            {displayData.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-400">
                  {t("table.empty")}
                </td>
              </tr>
            ) : (
              displayData.map((row, i) => {
                const id = rowId(row, i);
                const isSelected = selected.includes(id);
                return (
                  <tr
                    key={id}
                    className={cn(
                      "h-[52px] border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50",
                      isSelected && "bg-emerald-50/40",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className="w-12 px-0 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={t("table.selectAll")}
                          className={checkboxClass}
                          checked={isSelected}
                          onChange={() => toggleRow(id)}
                        />
                      </td>
                    )}
                    {columns.map((col, colIdx) => (
                      <td
                        key={String(col.key)}
                        className={cn(
                          "px-4 text-sm text-slate-900",
                          colIdx === 0 && !selectable && "font-medium",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          col.className
                        )}
                      >
                        {col.render ? col.render(row) : String(row[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {(totalPages > 1 || totalRecords !== undefined) && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-[13px] text-slate-500">{rowCountLabel}</span>
            {totalPages > 1 && onPageChange && (
              <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
