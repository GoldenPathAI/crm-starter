import { CardSkeleton, PageHeaderSkeleton, TabsSkeleton } from "../_components/PageSkeletons"

export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-6">
        <TabsSkeleton count={5} />
        <CardSkeleton lines={5} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  )
}
