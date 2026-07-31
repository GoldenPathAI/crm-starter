export const SETTINGS_TAB_KEYS = [
  "clenove",
  "ciselniky",
  "organizace",
  "data",
  "historie",
] as const

export type SettingsTabKey = (typeof SETTINGS_TAB_KEYS)[number]
