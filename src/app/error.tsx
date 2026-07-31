"use client"

import { useEffect } from "react"
import { reportClientError } from "@/app/_components/ClientErrorReporter"

// Route-level crash page: replaces Next's bare "Application error" with a Czech
// fallback and ships the stack to the server so the crash is debuggable later.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError({
      message: error.message,
      stack: `${error.digest ?? ""}\n${error.stack ?? ""}`,
      source: "route-error-boundary",
    })
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">Něco se pokazilo</h1>
      <p className="max-w-md text-sm text-muted">
        Chybu jsem zaznamenal. Zkus stránku načíst znovu; pokud to nepomůže, obnov celou
        aplikaci.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Zkusit znovu
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="cursor-pointer rounded-lg border border-border-strong/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
        >
          Obnovit stránku
        </button>
      </div>
    </main>
  )
}
