/**
 * Structured logger with request-scoped context (traceId, userId, orgId).
 *
 * Why not just console.log?
 *   - Log aggregators (Vercel, Cloudwatch, Datadog, Grafana Loki) parse JSON
 *     log lines automatically. Plain text is unsearchable.
 *   - Distributed tracing across HTTP → queue → worker requires a propagated
 *     traceId. Without it you cannot follow a request across processes.
 *   - Forgetting to log userId/orgId on errors is the most common reason an
 *     incident postmortem stalls.
 *
 * This module is intentionally dependency-free (no pino, no winston). The API is
 * shaped to be a drop-in target for pino later — `logger.info(ctx, msg)` or
 * `logger.info({...ctx, msg})` both work.
 *
 * Usage:
 *   import { logger, runWithLogContext } from "@/lib/logger"
 *
 *   // At a request entry point:
 *   await runWithLogContext({ traceId, userId, orgId, path }, async () => {
 *     logger.info("scan.received")
 *     await processScan(...)
 *   })
 *
 *   // Anywhere downstream — context is inherited from the surrounding scope:
 *   logger.warn({ err: e.message }, "scan.write.failed")
 */

import { AsyncLocalStorage } from "node:async_hooks"

export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogContext = {
  traceId?: string
  userId?: string | null
  orgId?: string | null
  path?: string | null
  [key: string]: unknown
}

const storage = new AsyncLocalStorage<LogContext>()

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const envLevel = (process.env.LOG_LEVEL?.toLowerCase() ?? (process.env.NODE_ENV === "production" ? "info" : "debug")) as LogLevel
const MIN_LEVEL = LEVEL_RANK[envLevel] ?? LEVEL_RANK.info

function emit(level: LogLevel, fields: Record<string, unknown>, message: string): void {
  if (LEVEL_RANK[level] < MIN_LEVEL) return
  const context = storage.getStore() ?? {}
  const payload = {
    level,
    time: new Date().toISOString(),
    ...context,
    ...fields,
    msg: message,
  }
  // Use the matching console method so dev tooling colourises levels correctly.
  const writer =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "debug"
          ? console.debug
          : console.log
  try {
    writer(JSON.stringify(payload))
  } catch {
    // Fallback if a field contains a circular reference.
    writer(`{"level":"${level}","time":"${payload.time}","msg":${JSON.stringify(message)}}`)
  }
}

function normalizeArgs(
  fieldsOrMessage: string | Record<string, unknown>,
  maybeMessage?: string,
): { fields: Record<string, unknown>; message: string } {
  if (typeof fieldsOrMessage === "string") {
    return { fields: {}, message: fieldsOrMessage }
  }
  return { fields: fieldsOrMessage, message: maybeMessage ?? "" }
}

export const logger = {
  debug(fieldsOrMessage: string | Record<string, unknown>, message?: string) {
    const { fields, message: msg } = normalizeArgs(fieldsOrMessage, message)
    emit("debug", fields, msg)
  },
  info(fieldsOrMessage: string | Record<string, unknown>, message?: string) {
    const { fields, message: msg } = normalizeArgs(fieldsOrMessage, message)
    emit("info", fields, msg)
  },
  warn(fieldsOrMessage: string | Record<string, unknown>, message?: string) {
    const { fields, message: msg } = normalizeArgs(fieldsOrMessage, message)
    emit("warn", fields, msg)
  },
  error(fieldsOrMessage: string | Record<string, unknown>, message?: string) {
    const { fields, message: msg } = normalizeArgs(fieldsOrMessage, message)
    emit("error", fields, msg)
  },
}

/**
 * Run `fn` with the given log context. Any `logger.*` call inside `fn` (or any
 * function it awaits) inherits this context automatically via AsyncLocalStorage.
 * Nested calls override individual fields without losing the rest.
 */
export function runWithLogContext<T>(ctx: LogContext, fn: () => Promise<T> | T): Promise<T> | T {
  const merged = { ...(storage.getStore() ?? {}), ...ctx }
  return storage.run(merged, fn)
}

/** Merge fields into the current context for the rest of this scope. */
export function setLogContext(ctx: Partial<LogContext>): void {
  const current = storage.getStore()
  if (!current) return
  Object.assign(current, ctx)
}

export function getLogContext(): LogContext | null {
  return storage.getStore() ?? null
}

/** Convenience for catch blocks. */
export function serializeError(err: unknown): { errMessage: string; errName?: string; errStack?: string } {
  if (err instanceof Error) {
    return { errMessage: err.message, errName: err.name, errStack: err.stack }
  }
  return { errMessage: String(err) }
}
