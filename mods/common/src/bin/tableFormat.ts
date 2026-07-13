/**
 * Renders rows as aligned columns: each column as wide as its widest cell,
 * numeric-looking cells right-aligned, two spaces between columns. Width is
 * computed from the data, so alignment holds for any campaign name or count.
 * Shared by every CLI bin in this package that prints a plain-ASCII table.
 */
export function alignColumns(rows: string[][], indent = "  "): string[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  const numeric = /^[\d,.%]+$/;
  return rows.map((row) =>
    (
      indent +
      row
        .map((cell, i) => {
          const w = widths[i];
          // Last column flows free; numbers right-align under their header.
          if (i === row.length - 1) return cell;
          return numeric.test(cell) ? cell.padStart(w) : cell.padEnd(w);
        })
        .join("  ")
    ).trimEnd()
  );
}
