export const CLIENT_TAB_KEYS = ["prehled", "aktivita", "projekty", "dokumenty"] as const

export type ClientTabKey = (typeof CLIENT_TAB_KEYS)[number]
