"use client"

import { createContext, useContext } from "react"
import type { OrgRole } from "@/core/types/crm.types"

export interface OrgContextValue {
  orgSlug: string
  orgName: string
  role: OrgRole
  user: { id: string; name: string; email: string }
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({
  value,
  children,
}: {
  value: OrgContextValue
  children: React.ReactNode
}) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useOrg(): OrgContextValue {
  const value = useContext(OrgContext)
  if (value === null) {
    throw new Error("useOrg must be used within an OrgProvider")
  }
  return value
}
