"use client"

import { useId } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Select } from "@/app/_ui/Select"
import { cn } from "@/lib/cn"
import { PAGE_SIZE_OPTIONS } from "@/lib/pageSize"

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

const pagerButtonClasses = cn(
  "inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-150",
  "hover:bg-surface-3/60 hover:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
)

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  const pageSizeSelectId = useId()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const isFirst = page <= 1
  const isLast = page >= totalPages

  return (
    <div className="flex items-center justify-end gap-2">
      {onPageSizeChange !== undefined ? (
        <>
          <label htmlFor={pageSizeSelectId} className="sr-only">
            Počet řádků na stránku
          </label>
          <Select
            id={pageSizeSelectId}
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number.parseInt(value, 10))}
            options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) }))}
            className="h-8 w-20 rounded-lg px-2.5 text-[13px]"
          />
        </>
      ) : null}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => onPageChange(page - 1)}
          aria-label="Předchozí stránka"
          className={pagerButtonClasses}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-14 text-center text-[13px] tabular-nums text-muted">
          {page} z {totalPages}
        </span>
        <button
          type="button"
          disabled={isLast}
          onClick={() => onPageChange(page + 1)}
          aria-label="Další stránka"
          className={pagerButtonClasses}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
