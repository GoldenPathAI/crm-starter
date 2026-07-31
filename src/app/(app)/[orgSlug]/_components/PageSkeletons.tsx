import { Skeleton } from "@/app/_ui/Skeleton"
import { cn } from "@/lib/cn"

export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div aria-hidden className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction ? <Skeleton className="h-8 w-32 rounded-full" /> : null}
    </div>
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full max-w-md" />
      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-soft">
        <div className="flex items-center gap-6 border-b border-hairline px-4 py-3">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="hidden h-3.5 w-20 sm:block" />
          <Skeleton className="ml-auto h-3.5 w-16" />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-6 border-b border-hairline px-4 py-3.5 last:border-0"
          >
            <Skeleton className="h-4 w-44 max-w-[40%]" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="hidden h-4 w-20 sm:block" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div aria-hidden className="rounded-2xl border border-hairline bg-surface px-5 py-4 shadow-soft">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-8 w-28" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  )
}

export function StatGridSkeleton({
  count = 4,
  className = "grid-cols-2 lg:grid-cols-4",
}: {
  count?: number
  className?: string
}) {
  return (
    <div aria-hidden className={cn("grid gap-4", className)}>
      {Array.from({ length: count }, (_, index) => (
        <StatCardSkeleton key={index} />
      ))}
    </div>
  )
}

export function CardSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("rounded-2xl border border-hairline bg-surface p-6 shadow-soft", className)}
    >
      <Skeleton className="h-5 w-36" />
      <div className="mt-5 flex flex-col gap-3">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className={cn("h-4", index % 2 === 0 ? "w-full" : "w-3/4")} />
        ))}
      </div>
    </div>
  )
}

export function TabsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden className="flex items-center gap-4 border-b border-hairline pb-3">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-4 w-20" />
      ))}
    </div>
  )
}

export function DetailHeaderSkeleton() {
  return (
    <div aria-hidden className="rounded-2xl border border-hairline bg-surface p-6 shadow-soft">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <Skeleton className="h-8 w-64 max-w-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function BoardSkeleton({ columns = 5, cards = 3 }: { columns?: number; cards?: number }) {
  return (
    <div aria-hidden className="flex items-stretch gap-4 overflow-hidden pb-2">
      {Array.from({ length: columns }, (_, columnIndex) => (
        <div key={columnIndex} className="flex min-w-[216px] flex-1 flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <Skeleton className="size-2 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: Math.max(1, cards - (columnIndex % 2)) }, (_, cardIndex) => (
              <Skeleton key={cardIndex} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
