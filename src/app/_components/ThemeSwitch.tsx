"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  isThemePreference,
  resolveTheme,
  type ThemePreference,
} from "@/app/_lib/theme"
import { cn } from "@/lib/cn"

const OPTIONS = [
  { value: "light", label: "Světlý", icon: Sun },
  { value: "system", label: "Systém", icon: Monitor },
  { value: "dark", label: "Tmavý", icon: Moon },
] as const satisfies ReadonlyArray<{
  value: ThemePreference
  label: string
  icon: typeof Sun
}>

const readPreference = (): ThemePreference => {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)

  return isThemePreference(stored) ? stored : "system"
}

const applyPreference = (preference: ThemePreference): void => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const theme = resolveTheme(preference, prefersDark)
  document.documentElement.setAttribute("data-theme", theme)
  document.documentElement.style.colorScheme = theme
}

export function useThemePreference(): {
  preference: ThemePreference
  mounted: boolean
  setPreference: (next: ThemePreference) => void
} {
  const [preference, setPreferenceState] = useState<ThemePreference>("system")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setPreferenceState(readPreference())
    setMounted(true)

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onSystemChange = (): void => {
      applyPreference(readPreference())
    }

    const onPreferenceChange = (): void => {
      const next = readPreference()
      setPreferenceState(next)
      applyPreference(next)
    }

    media.addEventListener("change", onSystemChange)
    window.addEventListener("storage", onPreferenceChange)
    window.addEventListener(THEME_CHANGE_EVENT, onPreferenceChange)

    return () => {
      media.removeEventListener("change", onSystemChange)
      window.removeEventListener("storage", onPreferenceChange)
      window.removeEventListener(THEME_CHANGE_EVENT, onPreferenceChange)
    }
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
    setPreferenceState(next)
    applyPreference(next)
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }, [])

  return { preference, mounted, setPreference }
}

export function ThemeSwitch({
  size = "sm",
  className,
}: {
  size?: "sm" | "md"
  className?: string
}) {
  const { preference, mounted, setPreference } = useThemePreference()

  return (
    <div
      role="radiogroup"
      aria-label="Motiv"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-surface-2 p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const active = mounted && preference === option.value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => {
              setPreference(option.value)
            }}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              size === "sm" ? "size-6" : "size-8",
              active
                ? "bg-surface text-foreground shadow-soft"
                : "text-muted-soft hover:text-foreground",
            )}
          >
            <Icon className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={2.25} />
          </button>
        )
      })}
    </div>
  )
}
