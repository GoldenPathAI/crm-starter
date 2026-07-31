"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { matchNavItem } from "@/app/_components/navItems"

// Per-route tab titles for the app shell. The route pages do not export their own
// metadata, so the active section label drives document.title from one place.
export function TitleSync() {
  const pathname = usePathname()

  useEffect(() => {
    const label = matchNavItem(pathname)?.label
    document.title = label !== undefined ? `${label} - CRM` : "CRM"
  }, [pathname])

  return null
}
