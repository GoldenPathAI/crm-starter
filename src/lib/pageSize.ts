import { config } from "@/lib/config"

// The only page sizes a list surface accepts. The default (25) is stored as an
// absent `pageSize` URL param; anything not whitelisted falls back to it.
export const PAGE_SIZE_OPTIONS: ReadonlyArray<number> = [25, 50, 100]

export const DEFAULT_PAGE_SIZE: number = config.defaultPageSize

export const parsePageSize = (value: string | string[] | undefined): number => {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === undefined) {
    return DEFAULT_PAGE_SIZE
  }

  const parsed = Number.parseInt(raw, 10)

  return PAGE_SIZE_OPTIONS.find((option) => option === parsed) ?? DEFAULT_PAGE_SIZE
}
