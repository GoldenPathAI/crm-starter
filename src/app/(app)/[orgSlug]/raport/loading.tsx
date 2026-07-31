import { PageShell } from "@/app/_ui/PageShell"
import { PageHeaderSkeleton, TableSkeleton } from "../_components/PageSkeletons"

export default function Loading() {
  return (
    <PageShell wide aria-busy="true" className="gap-5">
      <PageHeaderSkeleton withAction />
      <TableSkeleton rows={8} />
    </PageShell>
  )
}
