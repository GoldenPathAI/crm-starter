import { PageShell } from "@/app/_ui/PageShell"
import { Skeleton } from "@/app/_ui/Skeleton"
import { CardSkeleton, StatGridSkeleton } from "../_components/PageSkeletons"

export default function Loading() {
  return (
    <PageShell wide aria-busy="true" className="gap-8">
      <header aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </header>
      <StatGridSkeleton count={3} />
      <CardSkeleton lines={3} />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={4} />
    </PageShell>
  )
}
