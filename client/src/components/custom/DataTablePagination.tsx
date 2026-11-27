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
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const showPageSize = Boolean(onPageSizeChange && totalItems > pageSizeOptions[0]);
  const showPagination = totalPages > 1;

  // When only 1 page and items <= 10, keep footer minimal and quiet without unnecessary clutter
  if (!showPagination && !showPageSize) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/70 bg-card/30 text-xs text-muted-foreground select-none">
        <span>
          Showing <span className="font-mono text-foreground font-medium tabular-nums">{startItem === endItem ? totalItems : `${startItem}–${endItem}`}</span> of{" "}
          <span className="font-mono text-foreground font-medium tabular-nums">{totalItems}</span> {itemLabel}
        </span>
      </div>
    );
  }

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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 border-t border-border/70 bg-card/30 text-xs text-muted-foreground select-none">
      {/* Left: Range and optional Page Size */}
      <div className="flex items-center gap-3 flex-wrap">
        <span>
          Showing <span className="font-mono text-foreground font-medium tabular-nums">{startItem}</span>–
          <span className="font-mono text-foreground font-medium tabular-nums">{endItem}</span> of{" "}
          <span className="font-mono text-foreground font-medium tabular-nums">{totalItems}</span> {itemLabel}
        </span>

        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-border/60 text-[11px]">
            <span>Per page:</span>
            <div className="flex items-center gap-1">
              {pageSizeOptions.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    onPageSizeChange(size);
                    onPageChange(1);
                  }}
                  className={`h-5 px-1.5 rounded text-[11px] font-mono transition-colors ${
                    pageSize === size
                      ? "bg-muted border border-border text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Page Navigation (Only shown when > 1 page) */}
      {showPagination && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="flex items-center gap-0.5">
            {getPageNumbers().map((page, idx) =>
              typeof page === "number" ? (
                <button
                  key={idx}
                  onClick={() => onPageChange(page)}
                  className={`h-6 min-w-[24px] px-1.5 rounded text-xs font-mono tabular-nums transition-colors ${
                    currentPage === page
                      ? "bg-muted border border-border text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  {page}
                </button>
              ) : (
                <span key={idx} className="px-1 text-muted-foreground/50 select-none">
                  ...
                </span>
              )
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            title="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};
