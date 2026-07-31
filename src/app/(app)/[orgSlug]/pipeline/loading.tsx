import { PageShell } from "@/app/_ui/PageShell"
import { BoardSkeleton, PageHeaderSkeleton, StatGridSkeleton } from "../_components/PageSkeletons"

export default function Loading() {
  return (
    <PageShell wide aria-busy="true" className="gap-6">
      <PageHeaderSkeleton withAction />
      <StatGridSkeleton count={3} className="grid-cols-1 sm:grid-cols-3" />
      <BoardSkeleton columns={5} />
    </PageShell>
  )
}
