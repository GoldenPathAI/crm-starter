"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/cn"

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => {
        setCopied(false)
      },
    )
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Zkopírováno" : "Kopírovat příkaz"}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-soft transition-colors hover:bg-surface-3 hover:text-foreground",
        copied && "text-green-text",
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}
