// Next.js instrumentation hook (stable in Next 15, no config flag needed). Installs
// last-resort process handlers so a crash that escapes every request path still gets
// recorded. Guarded to the Node.js runtime; the edge runtime has no process handlers.
// Wire your own alerting (Telegram, Slack, Sentry) into reportFatal.
export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }

  const reportFatal = (kind: string, error: Error): void => {
    console.error(`[fatal] ${kind}: ${error.message}`, error.stack)
  }

  process.on("unhandledRejection", (reason: unknown) => {
    reportFatal(
      "unhandled promise rejection",
      reason instanceof Error ? reason : new Error(String(reason)),
    )
  })

  process.on("uncaughtException", (error: Error) => {
    reportFatal("uncaught exception", error)
  })
}
