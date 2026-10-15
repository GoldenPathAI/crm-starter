import { cn } from "@/lib/cn"

// The app's glyph on the primary tile. A fork swaps the path for its own mark.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-soft",
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="size-[58%]" aria-hidden="true">
        <path
          d="M21.3 11.9 A6.7 6.7 0 1 0 22.7 16.9 L16.7 16.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
