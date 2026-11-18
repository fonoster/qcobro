import { Flags } from "@oclif/core";

/** The period and portfolio filter shared by the `recovery:*` commands. */
export const periodFlags = {
  from: Flags.string({ description: "start date, inclusive (YYYY-MM-DD)", required: true }),
  to: Flags.string({ description: "end date, inclusive (YYYY-MM-DD)", required: true }),
  "portfolio-id": Flags.string({ description: "limit to one portfolio" })
};

/** Paging flags for commands that list a page of rows. */
export const pagingFlags = {
  limit: Flags.integer({ description: "rows per page", default: 50, min: 1, max: 200 }),
  offset: Flags.integer({ description: "rows to skip", default: 0, min: 0 })
};

/** The footer under a page of rows: `Showing 1-50 of 312.` */
export function pageFooter(offset: number, shown: number, total: number): string {
  return shown === 0
    ? `Showing 0 of ${total}.`
    : `Showing ${offset + 1}-${offset + shown} of ${total}.`;
}

/** The calendar date of an ISO 8601 timestamp as the API returns it (`2026-10-12`). */
export function isoDate(value: string | Date): string {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}
