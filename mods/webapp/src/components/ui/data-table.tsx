import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { useI18n } from "@/lib/i18n.js";
import { SearchBox } from "./input.js";
import { Pagination } from "./pagination.js";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  /** Numeric, id and amount cells: Roboto Mono. */
  mono?: boolean;
  /** Fixed column width (px number or any CSS width). Unset columns share the rest. */
  width?: number | string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Classes for the search box (its width; 320 px by default). */
  searchClassName?: string;
  /** Filter chips (or any control) placed after the search box. */
  filters?: React.ReactNode;
  /** Replaces the search box entirely. */
  filterElement?: React.ReactNode;
  /** The toolbar's right end, usually the count ("128 cuentas"). See `countLabel`. */
  toolbarEnd?: React.ReactNode;
  /**
   * Renders "N <countLabel>" at the toolbar's right end, N = rows after search (or
   * `totalRecords`). Pass the plural noun ("cuentas"); ignored when `toolbarEnd` is set.
   */
  countLabel?: string;
  /** Row height in px per screen: 48 Panel · 56 lists (default) · 60 Carteras · 64 Campañas. */
  rowHeight?: number;
  onRowClick?: (row: T) => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  totalRecords?: number;
  /** Rows per page, for the "Mostrando a–b de N" range when paginating. */
  pageSize?: number;
  /** The plural noun in the pagination line ("Mostrando 1–10 de 42 cuentas"). */
  itemLabel?: string;
  /**
   * Shown instead of the table when `data` is empty (not when a search empties it):
   * usually an <EmptyState />. The toolbar hides with it, unless it carries filters (a
   * filter can be what emptied the list, so it must stay reachable).
   */
  empty?: React.ReactNode;
  className?: string;
  /** Enables the leading checkbox column. */
  selectable?: boolean;
  /** Stable id per row for selection. Falls back to `keyField`. Required when `selectable`. */
  getRowId?: (row: T) => string;
  /** Controlled selection. */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Action nodes shown in the toolbar's selection bar while rows are selected. */
  bulkActions?: React.ReactNode;
  /** @deprecated Headers are always uppercase now. */
  uppercaseHeaders?: boolean;
}

/** Two-line cell for a table's primary column: name 14/500 + a mono 11 muted sub-identifier. */
export function TableCellStack({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium text-fg">{title}</span>
      {sub != null && sub !== "" && (
        <span className="font-mono text-[11px] text-fg-muted">{sub}</span>
      )}
    </div>
  );
}

/** The toolbar count text ("128 cuentas"). */
export function TableCount({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] text-fg-muted">{children}</span>;
}

/**
 * A data table: toolbar (search + filters left, count right), a card with uppercase 11 px
 * muted headers on no fill and rows of `rowHeight`, then the pagination line outside the
 * card ("Mostrando a–b de N <itemLabel>" · Anterior · x / y · Siguiente).
 *
 * @example <DataTable columns={cols} data={rows} rowHeight={60} countLabel="carteras" searchPlaceholder="Buscar carteras" empty={<EmptyState … />} />
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField,
  searchable = true,
  searchPlaceholder,
  searchClassName,
  filters,
  filterElement,
  toolbarEnd,
  countLabel,
  rowHeight = 56,
  onRowClick,
  page = 1,
  totalPages = 1,
  onPageChange,
  totalRecords,
  pageSize,
  itemLabel,
  empty,
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

  const total = totalRecords ?? displayData.length;
  const perPage = pageSize ?? (totalRecords !== undefined ? Math.ceil(total / totalPages || 1) : 0);
  const pageStart = total === 0 ? 0 : perPage ? (page - 1) * perPage + 1 : 1;
  const pageEnd = perPage ? Math.min(page * perPage, total) : displayData.length;

  const rangeLabel = t("table.rowCount")
    .replace("{start}", String(pageStart))
    .replace("{end}", String(pageEnd))
    .replace("{total}", String(total))
    .replace("{items}", itemLabel ?? t("table.items"));

  const colSpan = columns.length + (selectable ? 1 : 0);
  const showSelectionBar = selectable && selected.length > 0;
  const end =
    toolbarEnd ?? (countLabel ? <TableCount>{`${total} ${countLabel}`}</TableCount> : null);
  const hasToolbar = searchable || filterElement || filters || end;
  const showEmpty = empty !== undefined && data.length === 0;
  const showPagination = !showEmpty && (totalPages > 1 || totalRecords !== undefined);

  const checkboxClass = "h-4 w-4 cursor-pointer rounded border-input accent-primary";
  const widthStyle = (w?: number | string) =>
    w === undefined ? undefined : { width: typeof w === "number" ? `${w}px` : w };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {(hasToolbar || showSelectionBar) && (!showEmpty || filterElement || filters) && (
        <div className="flex min-h-[38px] items-center justify-between gap-3">
          {showSelectionBar ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-fg">
                  {t("table.selected").replace("{count}", String(selected.length))}
                </span>
                {bulkActions}
              </div>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="flex cursor-pointer items-center gap-1 text-sm text-fg-muted hover:text-fg"
              >
                <X className="h-4 w-4" />
                {t("common.cancel")}
              </button>
            </>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-3">
                {filterElement ??
                  (searchable ? (
                    <SearchBox
                      placeholder={searchPlaceholder ?? t("table.searchPlaceholder")}
                      aria-label={searchPlaceholder ?? t("table.searchPlaceholder")}
                      className={searchClassName ?? "w-80"}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  ) : null)}
                {filters}
              </div>
              {end && <div className="flex shrink-0 items-center gap-3">{end}</div>}
            </>
          )}
        </div>
      )}

      {showEmpty ? (
        empty
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <table className="w-full">
            <thead>
              <tr className="h-10">
                {selectable && (
                  <th className="w-12 px-0 pl-5 text-left">
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
                {columns.map((col, i) => (
                  <th
                    key={String(col.key)}
                    style={widthStyle(col.width)}
                    className={cn(
                      "px-3 text-left text-[11px] font-normal uppercase tracking-[0.5px] text-fg-muted",
                      i === 0 && !selectable && "pl-5",
                      i === columns.length - 1 && "pr-5",
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
                <tr className="border-t border-border">
                  <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-fg-muted">
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
                      style={{ height: rowHeight }}
                      className={cn(
                        "border-t border-border transition-colors hover:bg-elevated/60",
                        isSelected && "bg-elevated",
                        onRowClick && "cursor-pointer"
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {selectable && (
                        <td className="w-12 px-0 pl-5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={t("table.selectRow")}
                            className={checkboxClass}
                            checked={isSelected}
                            onChange={() => toggleRow(id)}
                          />
                        </td>
                      )}
                      {columns.map((col, colIdx) => (
                        <td
                          key={String(col.key)}
                          style={widthStyle(col.width)}
                          className={cn(
                            "px-3 text-[13px] text-fg",
                            colIdx === 0 && !selectable && "pl-5 font-medium",
                            colIdx === columns.length - 1 && "pr-5",
                            col.mono && "font-mono",
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
        </div>
      )}

      {showPagination && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-fg-muted">{rangeLabel}</span>
          {totalPages > 1 && onPageChange && (
            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
          )}
        </div>
      )}
    </div>
  );
}
