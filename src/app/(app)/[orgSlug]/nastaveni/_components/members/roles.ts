import type { OrgRole } from "@/core/types/crm.types"

export const ROLE_LABEL: Readonly<Record<OrgRole, string>> = {
  owner: "Vlastník",
  admin: "Admin",
  member: "Člen",
}

export const ROLE_BADGE: Readonly<Record<OrgRole, string>> = {
  owner: "bg-purple-soft text-purple-text",
  admin: "bg-blue-soft text-blue-text",
  member: "bg-surface-3/60 text-muted",
}
