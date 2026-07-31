import {
  Building2,
  FolderKanban,
  HeartHandshake,
  Kanban,
  LayoutDashboard,
  ListChecks,
  Settings,
  type LucideIcon,
} from "lucide-react"
import type { Permission } from "@/lib/auth/permissions"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  tileClassName: string
  permission?: Permission
}

export const navItems: ReadonlyArray<NavItem> = [
  { href: "/prehled", label: "Přehled", icon: LayoutDashboard, tileClassName: "bg-blue" },
  { href: "/klienti", label: "Klienti", icon: Building2, tileClassName: "bg-indigo" },
  { href: "/raport", label: "Raport", icon: HeartHandshake, tileClassName: "bg-pink" },
  { href: "/pipeline", label: "Pipeline", icon: Kanban, tileClassName: "bg-teal" },
  { href: "/projekty", label: "Projekty", icon: FolderKanban, tileClassName: "bg-purple" },
  { href: "/ukoly", label: "Úkoly", icon: ListChecks, tileClassName: "bg-orange" },
  { href: "/nastaveni", label: "Nastavení", icon: Settings, tileClassName: "bg-muted-soft" },
]

// The app shell lives under /[orgSlug], so the first path segment is always the org
// slug. Nav hrefs are org-relative suffixes ("/prehled"), matched against the path
// with the org segment stripped.
export function orgRelativePath(pathname: string): string {
  const secondSlash = pathname.indexOf("/", 1)
  return secondSlash === -1 ? "/" : pathname.slice(secondSlash)
}

export function matchNavItem(pathname: string): NavItem | undefined {
  const path = orgRelativePath(pathname)
  return navItems
    .filter((item) => path === item.href || path.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)
    .at(0)
}
