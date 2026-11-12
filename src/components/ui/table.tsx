import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Spinner } from "./button";
import { cn } from "./cn";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  rowClassName,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={rowClassName?.(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pageList(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) out.push("gap");
    out.push(value);
  });
  return out;
}

export function Pagination({
  page,
  pageCount,
  onPage,
  label,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  label: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="mt-5 flex flex-wrap items-center justify-end gap-3">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
      </button>
      {pageList(page, pageCount).map((value, index) =>
        value === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-ink-2" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={value}
            type="button"
            className={cn("btn btn-secondary btn-sm num", value === page && "btn-page-active")}
            aria-current={value === page ? "page" : undefined}
            onClick={() => onPage(value)}
          >
            <span className="sr-only">Page </span>
            {value}
          </button>
        ),
      )}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
      >
        <ChevronRight size={16} strokeWidth={1.5} />
      </button>
    </nav>
  );
}

/** Server pages with no total: Previous / Next only. */
export function PrevNext({
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  label,
}: {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  label: string;
}) {
  if (!hasPrevious && !hasNext) return null;
  return (
    <nav aria-label={label} className="mt-5 flex justify-end gap-3">
      <button type="button" className="btn btn-secondary" onClick={onPrevious} disabled={!hasPrevious}>
        <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        Previous page
      </button>
      <button type="button" className="btn btn-secondary" onClick={onNext} disabled={!hasNext}>
        Next page
        <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </nav>
  );
}

export function LoadMore({
  onClick,
  loading,
  disabled,
  label = "Load older transactions",
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  label?: string;
}) {
  return (
    <div className="mt-5 flex justify-center">
      <button type="button" className="btn btn-secondary" onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined}>
        {loading ? <Spinner /> : null}
        {label}
      </button>
    </div>
  );
}
