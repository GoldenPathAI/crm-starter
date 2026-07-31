"use client"

import { Search } from "lucide-react"
import { usePathname } from "next/navigation"
import { MobileNav } from "@/app/_components/MobileNav"
import { matchNavItem } from "@/app/_components/navItems"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { openCommandPalette } from "@/app/_components/command/CommandPalette"
import type { UserMembership } from "@/lib/crm/store/members"

export function TopBar({ memberships }: { memberships: ReadonlyArray<UserMembership> }) {
  const pathname = usePathname()
  const { orgName } = useOrg()
  const section = matchNavItem(pathname)?.label ?? orgName

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-5 sm:px-6 lg:px-8">
        <div className="lg:hidden">
          <MobileNav memberships={memberships} />
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">{section}</span>
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Hledat"
          className="ml-auto inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Search className="size-5" strokeWidth={2.25} />
        </button>
      </div>
    </header>
  )
}
