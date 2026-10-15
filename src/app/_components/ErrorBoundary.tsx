"use client"

import { Component, type ReactNode } from "react"
import { reportClientError } from "@/app/_components/ClientErrorReporter"

interface ErrorBoundaryProps {
  // Identifies the crashed area in the report ("assistant-dock", ...).
  source: string
  fallback: (reset: () => void) => ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
}

// Contains a render crash to its subtree: the rest of the app keeps working, the
// error is reported server-side and the fallback offers a reset.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  override componentDidCatch(error: Error): void {
    reportClientError({
      message: error.message,
      stack: error.stack ?? "",
      source: this.props.source,
    })
  }

  reset = (): void => {
    this.setState({ failed: false })
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return this.props.fallback(this.reset)
    }

    return this.props.children
  }
}
