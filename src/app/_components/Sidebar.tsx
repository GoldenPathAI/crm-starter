"use client"

import { Check, ChevronsUpDown, LogOut, Plus, Search, UserRound } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { openCommandPalette } from "@/app/_components/command/CommandPalette"
import { matchNavItem, navItems, orgRelativePath } from "@/app/_components/navItems"
import { hasPermission } from "@/lib/auth/permissions"
import { CreateWorkspaceDialog } from "@/app/_components/org/CreateWorkspaceDialog"
import { NotificationsBell } from "@/app/_components/notifications/NotificationsBell"
import { ThemeSwitch } from "@/app/_components/ThemeSwitch"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { Kbd } from "@/app/_ui/Kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { cn } from "@/lib/cn"
import type { UserMembership } from "@/lib/crm/store/members"
import { authClient } from "@/lib/auth/authClient"
import { orgHref } from "@/lib/nav"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0)
  if (parts.length === 0) {
    return "?"
  }

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")
}

export function Sidebar({
  memberships,
  onNavigate,
  className,
}: {
  memberships: ReadonlyArray<UserMembership>
  onNavigate?: () => void
  className?: string
}) {
  const pathname = usePathname()
  const { orgSlug, orgName, user, role } = useOrg()
  const activeHref = matchNavItem(pathname)?.href
  const subPath = orgRelativePath(pathname)
  const visibleNavItems = navItems.filter(
    (item) => item.permission === undefined || hasPermission(role, item.permission),
  )

  return (
    <div
      className={cn(
        "grid h-full grid-rows-[auto_1fr_auto] border-r border-hairline bg-bg",
        className,
      )}
    >
      <div className="flex flex-col gap-3 px-4 pb-3 pt-5">
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <OrgSwitcher
              orgSlug={orgSlug}
              orgName={orgName}
              memberships={memberships}
              subPath={subPath}
              onNavigate={onNavigate}
            />
          </div>
          <NotificationsBell />
        </div>

        <button
          type="button"
          onClick={() => {
            onNavigate?.()
            openCommandPalette()
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] text-muted-soft transition-colors hover:bg-surface-3/60 hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Search className="size-3.5 shrink-0" strokeWidth={2.25} />
          <span className="flex-1 text-left">Hledat</span>
          <Kbd className="shrink-0">⌘K</Kbd>
        </button>
      </div>

      <nav className="min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-0.5 px-4 py-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const active = item.href === activeHref

            return (
              <Link
                key={item.href}
                href={orgHref(orgSlug, item.href)}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                  active
                    ? "bg-surface text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
                    : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-[7px] transition-all duration-150",
                    item.tileClassName,
                    active ? "" : "opacity-80 saturate-[0.85] group-hover:opacity-100 group-hover:saturate-100",
                  )}
                >
                  <Icon className="size-3.5 text-white" strokeWidth={2.25} />
                </span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="flex flex-col gap-2.5 border-t border-hairline px-4 py-3">
        <ThemeSwitch className="self-start" />
        <UserMenu name={user.name} email={user.email} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function OrgSwitcher({
  orgSlug,
  orgName,
  memberships,
  subPath,
  onNavigate,
}: {
  orgSlug: string
  orgName: string
  memberships: ReadonlyArray<UserMembership>
  subPath: string
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-[12px] font-semibold text-primary-foreground">
              {initials(orgName)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-tight text-foreground">
              {orgName}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted" strokeWidth={2} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[220px]">
          {memberships.map((membership) => {
            const active = membership.slug === orgSlug

            return (
              <Link
                key={membership.orgId}
                href={orgHref(membership.slug, subPath)}
                onClick={() => {
                  setOpen(false)
                  onNavigate?.()
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-3 text-[11px] font-semibold text-muted">
                  {initials(membership.name)}
                </span>
                <span className="min-w-0 flex-1 truncate">{membership.name}</span>
                {active ? <Check className="size-4 shrink-0 text-primary" strokeWidth={2.25} /> : null}
              </Link>
            )
          })}
          <div className="my-1 border-t border-hairline" />
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setCreateOpen(true)
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong/70 text-muted">
              <Plus className="size-3.5" strokeWidth={2.25} />
            </span>
            Nová workspace
          </button>
        </PopoverContent>
      </Popover>
      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}

function UserMenu({
  name,
  email,
  onNavigate,
}: {
  name: string
  email: string
  onNavigate?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const onSignOut = async (): Promise<void> => {
    setPending(true)
    await authClient.signOut()
    router.push("/login")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[12px] font-semibold text-muted">
            {initials(name)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium text-foreground">{name}</span>
            <span className="truncate text-[11px] text-muted">{email}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[220px]">
        <Link
          href="/ucet"
          onClick={() => {
            setOpen(false)
            onNavigate?.()
          }}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <UserRound className="size-4 shrink-0 text-muted" strokeWidth={2} />
          Můj účet
        </Link>
        <button
          type="button"
          onClick={() => void onSignOut()}
          disabled={pending}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          <LogOut className="size-4 shrink-0 text-muted" strokeWidth={2} />
          Odhlásit se
        </button>
      </PopoverContent>
    </Popover>
  )
}
