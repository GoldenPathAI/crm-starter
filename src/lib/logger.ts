export type LogContext = Record<string, string | number | boolean | null | undefined>

export type Logger = {
  child(context: LogContext): Logger
  info(context: LogContext, message: string): void
  warn(context: LogContext, message: string): void
  error(context: LogContext, message: string): void
}

const emit = (
  level: "info" | "warn" | "error",
  base: LogContext,
  context: LogContext,
  message: string,
): void => {
  const record = { level, message, ...base, ...context, time: new Date().toISOString() }
  const line = JSON.stringify(record)
  if (level === "error") {
    console.error(line)

    return
  }

  if (level === "warn") {
    console.warn(line)

    return
  }

  console.info(line)
}

const make = (base: LogContext): Logger => ({
  child: (context) => make({ ...base, ...context }),
  info: (context, message) => emit("info", base, context, message),
  warn: (context, message) => emit("warn", base, context, message),
  error: (context, message) => emit("error", base, context, message),
})

export const rootLogger: Logger = make({ app: "crm" })

export type ModuleLoggerOptions = {
  layer: string
  module: string
  operation?: string
}

export const createModuleLogger = (logger: Logger, options: ModuleLoggerOptions): Logger =>
  logger.child({ ...options })

export const createServerLogger = (options: LogContext): Logger => rootLogger.child(options)

export type ActionableError = {
  problem: string
  why: string
  fix: string
  impact: string
}

export const logActionableError = (
  logger: Logger,
  error: Error,
  actionable: ActionableError,
  message: string,
  context: LogContext = {},
): void => {
  logger.error(
    {
      ...context,
      ...actionable,
      errorName: error.name,
      errorMessage: error.message,
    },
    message,
  )
}
