import { cn } from "@/lib/utils.js";
import { useI18n } from "@/lib/i18n.js";
import { Button } from "./button.js";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Anterior · "x / y" · Siguiente, outline buttons. */
export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  const { t } = useI18n();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        {t("table.previous")}
      </Button>
      <span className="px-1 font-mono text-[13px] text-fg-muted">
        {page} / {Math.max(totalPages, 1)}
      </span>
      <Button
        type="button"
        variant="outline"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        {t("table.next")}
      </Button>
    </div>
  );
}
