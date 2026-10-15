"use client"

import { useEffect } from "react"

// Caps per page load so a render loop or a misbehaving extension cannot flood the
// endpoint; the server throttles its own alerting separately.
const MAX_REPORTS = 5
let reportsSent = 0

export function reportClientError(input: {
  message: string
  stack?: string
  source: string
}): void {
  if (reportsSent >= MAX_REPORTS) {
    return
  }

  reportsSent += 1
  try {
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        message: input.message,
        stack: input.stack ?? "",
        source: input.source,
        url: window.location.href,
      }),
    })
  } catch {
    // Reporting must never throw into the app it is observing.
  }
}

// Global catch-all: uncaught errors and unhandled promise rejections anywhere in the
// client land in the server log, so a prod "Application error" page is
// debuggable after the fact instead of vanishing with the user's console.
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent): void => {
      reportClientError({
        message: event.message,
        stack: event.error instanceof Error ? (event.error.stack ?? "") : "",
        source: "window.onerror",
      })
    }

    const onRejection = (event: PromiseRejectionEvent): void => {
      const reason: unknown = event.reason
      reportClientError({
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? (reason.stack ?? "") : "",
        source: "unhandledrejection",
      })
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
