"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Measuring only while collapsed keeps the toggle visible after expanding:
 * an expanded node no longer overflows, so a naive check would hide the way back.
 */
export const useClampedOverflow = <T extends HTMLElement>(expanded: boolean, content: string) => {
  const ref = useRef<T>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (node === null || expanded) {
      return
    }
    const measure = () => {
      setOverflowing(node.scrollHeight > node.clientHeight + 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [expanded, content])

  return { ref, overflowing }
}
