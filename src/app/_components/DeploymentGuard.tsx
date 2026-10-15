"use client"

import { useEffect } from "react"

const POLL_INTERVAL_MS = 60_000
const RELOADED_FLAG = "crm-deploy-guard-reloaded"

// Self-heal for stale tabs: Next.js content-hashes server-action ids per build, so a tab
// left open across a deploy calls dead action ids and crashes. The server renders the live
// deploy id into the page (currentDeployId); this polls /api/version and hard-reloads once
// the running deploy no longer matches the page it loaded. Both ids come from the same
// runtime source, so a healthy deploy never mismatches. A one-shot sessionStorage flag makes
// a reload loop impossible even if the ids ever disagree for another reason.
export function DeploymentGuard({ currentDeployId }: { currentDeployId: string }) {
  useEffect(() => {
    if (currentDeployId === "dev") {
      return
    }

    let cancelled = false

    const check = async (): Promise<void> => {
      if (sessionStorage.getItem(RELOADED_FLAG) === currentDeployId) {
        return
      }

      try {
        const res = await fetch("/api/version", { cache: "no-store" })
        if (!res.ok) {
          return
        }

        const data: { deployId?: string } = await res.json()
        if (
          !cancelled &&
          typeof data.deployId === "string" &&
          data.deployId !== "dev" &&
          data.deployId !== currentDeployId
        ) {
          // Record which bundle we reloaded away from so a persistent mismatch cannot loop.
          sessionStorage.setItem(RELOADED_FLAG, currentDeployId)
          window.location.reload()
        }
      } catch {
        // A transient network blip must not disturb the app; the next tick retries.
      }
    }

    const onVisible = (): void => {
      if (document.visibilityState === "visible") {
        void check()
      }
    }

    void check()
    const timer = setInterval(() => {
      void check()
    }, POLL_INTERVAL_MS)
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [currentDeployId])

  return null
}
