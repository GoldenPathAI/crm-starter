import { Skeleton } from "@/app/_ui/Skeleton"
import { CardSkeleton, DetailHeaderSkeleton, TabsSkeleton } from "../../_components/PageSkeletons"

export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="h-3.5 w-44" />
      <DetailHeaderSkeleton />
      <TabsSkeleton count={4} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
    </div>
  )
}
