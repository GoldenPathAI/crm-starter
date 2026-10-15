"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { CheckCircle2, Info, X, XCircle } from "lucide-react"
import { cn } from "@/lib/cn"
import { createId } from "@/lib/ids"

export enum ToastVariant {
  Success = "Success",
  Error = "Error",
  Info = "Info",
}

interface ToastAction {
  label: string
  onAction: () => void
}

interface ToastOptions {
  title?: string
  description?: string
  variant?: ToastVariant
  action?: ToastAction
}

interface ToastItem {
  id: string
  title?: string
  description?: string
  variant: ToastVariant
  action?: ToastAction
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_VISIBLE = 3
const DISMISS_MS = 4000
const DISMISS_LONG_MS = 8000

const variantIcon: Readonly<Record<ToastVariant, typeof Info>> = {
  [ToastVariant.Success]: CheckCircle2,
  [ToastVariant.Error]: XCircle,
  [ToastVariant.Info]: Info,
}

const variantAccent: Readonly<Record<ToastVariant, string>> = {
  [ToastVariant.Success]: "bg-accent-soft text-accent",
  [ToastVariant.Error]: "bg-danger-soft text-danger",
  [ToastVariant.Info]: "bg-primary-soft text-primary",
}

function dismissAfterMs(item: ToastItem): number {
  if (item.action || item.variant === ToastVariant.Error) return DISMISS_LONG_MS

  return DISMISS_MS
}

interface ToastCardProps {
  item: ToastItem
  reduceMotion: boolean
  onDismiss: (id: string) => void
}

function ToastCard({ item, reduceMotion, onDismiss }: ToastCardProps) {
  const remainingRef = useRef(dismissAfterMs(item))
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoveredRef = useRef(false)
  const focusedRef = useRef(false)
  const dismissRef = useRef<() => void>(() => {})
  dismissRef.current = () => onDismiss(item.id)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    if (timerRef.current !== null) return
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      dismissRef.current()
    }, remainingRef.current)
  }, [])

  const pauseTimer = useCallback(() => {
    if (timerRef.current === null) return
    clearTimer()
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current))
  }, [clearTimer])

  const resumeIfIdle = useCallback(() => {
    if (!hoveredRef.current && !focusedRef.current) startTimer()
  }, [startTimer])

  useEffect(() => {
    startTimer()

    return clearTimer
  }, [startTimer, clearTimer])

  const Icon = variantIcon[item.variant]

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      role={item.variant === ToastVariant.Error ? "alert" : "status"}
      onPointerEnter={() => {
        hoveredRef.current = true
        pauseTimer()
      }}
      onPointerLeave={() => {
        hoveredRef.current = false
        resumeIfIdle()
      }}
      onFocus={() => {
        focusedRef.current = true
        pauseTimer()
      }}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
          return
        }

        focusedRef.current = false
        resumeIfIdle()
      }}
      className="pointer-events-auto flex w-80 items-start gap-3 rounded-2xl bg-surface px-4 py-3.5 shadow-lifted"
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          variantAccent[item.variant],
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        {item.title ? <p className="text-sm font-medium text-foreground">{item.title}</p> : null}
        {item.description ? <p className="text-xs text-muted">{item.description}</p> : null}
        {item.action ? (
          <button
            type="button"
            onClick={() => {
              item.action?.onAction()
              onDismiss(item.id)
            }}
            className="mt-1.5 cursor-pointer rounded-md text-xs font-semibold text-primary transition-colors hover:text-primary-hover"
          >
            {item.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Zavřít"
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const [items, setItems] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback((options: ToastOptions) => {
    const item: ToastItem = {
      id: createId("toast"),
      variant: options.variant ?? ToastVariant.Info,
      title: options.title,
      description: options.description,
      action: options.action,
    }
    setItems((prev) => [...prev, item].slice(-MAX_VISIBLE))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <ToastCard
                    key={item.id}
                    item={item}
                    reduceMotion={reduceMotion ?? false}
                    onDismiss={remove}
                  />
                ))}
              </AnimatePresence>
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast musí být použit uvnitř ToastProvider")
  }

  return context
}
