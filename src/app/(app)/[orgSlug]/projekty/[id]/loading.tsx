import { Skeleton } from "@/app/_ui/Skeleton"
import { BoardSkeleton, PageHeaderSkeleton } from "../../_components/PageSkeletons"

export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-3.5 w-44" />
        <PageHeaderSkeleton withAction />
        <Skeleton className="h-[72px] w-full rounded-2xl" />
      </div>
      <BoardSkeleton columns={4} />
    </div>
  )
}
