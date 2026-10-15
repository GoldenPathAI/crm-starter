import { isOneOf } from "@/lib/literals"

// Stored in localStorage and read by the inline init script, so the spelling is fixed.
export const THEME_PREFERENCES = ["light", "dark", "system"] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export const THEME_STORAGE_KEY = "crm-theme"

export const THEME_CHANGE_EVENT = "crm-theme-change"

export const isThemePreference = (value: string | null): value is ThemePreference =>
  value !== null && isOneOf(THEME_PREFERENCES, value)

export const resolveTheme = (
  preference: ThemePreference,
  prefersDark: boolean,
): "light" | "dark" => {
  if (preference === "system") {
    return prefersDark ? "dark" : "light"
  }

  return preference
}

// Runs before first paint in the document head, so the stored preference is applied
// without a flash of the light theme. Keep it dependency-free and self-contained.
export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(p!=="light"&&p!=="dark"){p=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var r=document.documentElement;r.setAttribute("data-theme",p);r.style.colorScheme=p}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`
