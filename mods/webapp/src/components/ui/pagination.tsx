import { cn } from "@/lib/utils.js";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-40"
      >
        Previous
      </button>
      <div className="h-10 w-10" />
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
