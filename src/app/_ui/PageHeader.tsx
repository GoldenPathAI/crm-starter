import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface BreadcrumbItem {
  label: string
  href: string
}

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumb?: BreadcrumbItem[]
}

export function PageHeader({ title, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav className="flex items-center gap-1 text-xs text-muted">
          {breadcrumb.map((item, index) => (
            <span key={item.href} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3 text-muted-soft" /> : null}
              <Link href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? <p className="mt-1 text-[15px] text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
