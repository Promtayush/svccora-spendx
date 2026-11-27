import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/custom/Button";

interface DataTablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export const DataTablePagination: React.FC<DataTablePaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  itemLabel = "claims",
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const delta = 1;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border/80 bg-card/40 text-xs text-muted-foreground select-none">
      {/* Left: Summary and Page Size */}
      <div className="flex items-center gap-4 flex-wrap">
        <span>
          Showing <strong className="font-mono text-foreground font-semibold tabular-nums">{startItem}</strong>–
          <strong className="font-mono text-foreground font-semibold tabular-nums">{endItem}</strong> of{" "}
          <strong className="font-mono text-foreground font-semibold tabular-nums">{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-border/60">
            <span>Per page:</span>
            <div className="flex items-center gap-1">
              {pageSizeOptions.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    onPageSizeChange(size);
                    onPageChange(1);
                  }}
                  className={`h-6 px-2 rounded text-[11px] font-mono transition-colors ${
                    pageSize === size
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Pagination Controls */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-7 px-2 text-xs gap-1 border-border/80 hover:bg-muted"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, idx) =>
            typeof page === "number" ? (
              <button
                key={idx}
                onClick={() => onPageChange(page)}
                className={`h-7 min-w-[28px] px-2 rounded text-xs font-mono tabular-nums transition-colors ${
                  currentPage === page
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "border border-border/60 bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {page}
              </button>
            ) : (
              <span key={idx} className="px-1 text-muted-foreground/60 select-none">
                ...
              </span>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-7 px-2 text-xs gap-1 border-border/80 hover:bg-muted"
          title="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
