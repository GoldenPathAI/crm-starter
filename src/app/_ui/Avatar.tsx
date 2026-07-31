import { cn } from "@/lib/cn"
import { initials as entityInitials } from "@/lib/initials"

const AVATAR_PALETTE = [
  "bg-blue-soft text-blue-text",
  "bg-green-soft text-green-text",
  "bg-orange-soft text-orange-text",
  "bg-purple-soft text-purple-text",
  "bg-teal-soft text-teal-text",
  "bg-indigo-soft text-indigo-text",
  "bg-cyan-soft text-cyan-text",
  "bg-red-soft text-red-text",
] as const

const SIZE = {
  sm: "size-6 text-[10px]",
  md: "size-9 text-xs",
} as const

export type AvatarSize = keyof typeof SIZE

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0)
  const first = parts[0]
  if (first === undefined) {
    return "?"
  }
  if (parts.length === 1) {
    return first.slice(0, 2).toUpperCase()
  }
  const last = parts[parts.length - 1] ?? first
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

// Deterministic color per user so the same person keeps one avatar hue everywhere.
const paletteClass = (seed: string): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]
}

// Squared initials chip for non-person entities (clients); same deterministic palette.
export function EntityAvatar({
  name,
  seed,
  className,
}: {
  name: string
  seed: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-md text-[9px] font-semibold",
        paletteClass(seed),
        className,
      )}
    >
      {entityInitials(name)}
    </span>
  )
}

export function Avatar({
  name,
  userId,
  size = "md",
  className,
}: {
  name: string
  userId: string
  size?: AvatarSize
  className?: string
}) {
  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        SIZE[size],
        paletteClass(userId),
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
