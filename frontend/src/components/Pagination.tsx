"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from "lucide-react"

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  showPageSizeSelector?: boolean
  showTotalCount?: boolean
  siblingCount?: number
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = false,
  showTotalCount = true,
  siblingCount = 1,
  className,
}: PaginationProps) {
  const range = useMemo(() => {
    const totalPageNumbers = siblingCount * 2 + 5

    if (totalPages <= totalPageNumbers) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages)

    const showLeftDots = leftSiblingIndex > 2
    const showRightDots = rightSiblingIndex < totalPages - 1

    if (!showLeftDots && showRightDots) {
      const leftItemCount = 3 + 2 * siblingCount
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1)
      return [...leftRange, "...", totalPages]
    }

    if (showLeftDots && !showRightDots) {
      const rightItemCount = 3 + 2 * siblingCount
      const rightRange = Array.from(
        { length: rightItemCount },
        (_, i) => totalPages - rightItemCount + i + 1,
      )
      return [1, "...", ...rightRange]
    }

    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i,
    )
    return [1, "...", ...middleRange, "...", totalPages]
  }, [currentPage, totalPages, siblingCount])

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  if (totalPages <= 1) return null

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:justify-between", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {showTotalCount && (
          <span>
            {startItem}–{endItem} of {totalItems}
          </span>
        )}
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger size="sm" className="h-7 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <nav className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        {range.map((page, index) => {
          if (page === "...") {
            return (
              <span
                key={`dots-${index}`}
                className="flex h-7 w-7 items-center justify-center"
              >
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            )
          }

          return (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="icon-xs"
              onClick={() => onPageChange(page as number)}
              className={cn(
                currentPage === page && "pointer-events-none",
              )}
            >
              {page}
            </Button>
          )
        })}

        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </nav>
    </div>
  )
}
