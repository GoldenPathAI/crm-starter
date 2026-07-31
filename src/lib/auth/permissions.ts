import type { OrgRole } from "@/core/types/crm.types"

const ROLE_RANK: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 }

export function roleAtLeast(role: OrgRole, minRole: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole]
}

// Feature permissions map to a minimum role. Adding a gated feature is one entry here,
// plus the guard at its page and the optional `permission` on its nav item. No module in
// the starter is gated beyond the owner/admin role checks in requireRole, so the map is
// empty; the plumbing (NavItem.permission, the Sidebar and command palette filters) is
// live and works the moment you add a key.
export type Permission = never

const PERMISSION_MIN_ROLE: Record<Permission, OrgRole> = {}

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return roleAtLeast(role, PERMISSION_MIN_ROLE[permission])
}
