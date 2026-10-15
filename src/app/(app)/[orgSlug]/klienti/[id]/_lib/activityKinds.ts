// Activity types the client detail logs by hand. They are written to activities.type as
// they are, so they keep the spelling of the default activity_type options.
export const ACTIVITY_KINDS = ["hovor", "schuzka", "poznamka"] as const

export type ActivityKind = (typeof ACTIVITY_KINDS)[number]
