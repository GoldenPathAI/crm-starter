import http from "node:http"
import https from "node:https"
import net from "node:net"

// Tests must never touch the outside world. A fork's `.env` carries real secrets (the
// Resend key, the AWS credentials, the internal API token), so an unmocked call inside a
// test would reach real mailboxes, buckets and deployments. This guard makes that
// impossible: every outbound connection fails, and the credentials are removed from the
// process so a forgotten mock degrades into "not configured" instead of a delivered mail.

// The only reachable hosts: any stub server a test starts itself, a local headless
// browser, and the Postgres host of the `_test` database.
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "0.0.0.0", "::1"]

// Everything that would let a test reach a person, a mailbox, a bucket or a deployment.
const OUTBOUND_CREDENTIAL_ENV_KEYS = [
  "RESEND_API_KEY",
  "INTERNAL_API_TOKEN",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_PROFILE",
]

// Postgres is the one remote service a test may talk to; the integration setup has
// already asserted that the database is a `_test` one.
const DATABASE_ENV_KEYS = ["DATABASE_URL", "TEST_DATABASE_URL"]

export class OutboundRequestBlockedError extends Error {
  constructor(target: string) {
    super(
      `Blocked outbound request to ${target}. Tests may not talk to the outside world: ` +
        "mock the module that makes this call (vi.mock) or point it at a local stub.",
    )
    this.name = "OutboundRequestBlockedError"
  }
}

type RequestTarget = string | URL | http.RequestOptions

const hostnameOfConnectionString = (value: string | undefined): string | null => {
  if (value === undefined || value.length === 0) {
    return null
  }

  return URL.canParse(value) ? new URL(value).hostname.toLowerCase() : null
}

const hostnameOfTarget = (target: RequestTarget): string => {
  if (typeof target === "string") {
    return URL.canParse(target) ? new URL(target).hostname : target
  }

  if (target instanceof URL) {
    return target.hostname
  }

  const host = target.hostname ?? target.host ?? "localhost"

  return host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "")
}

const isRequestTarget = (value: unknown): value is RequestTarget =>
  typeof value === "string" || value instanceof URL || (typeof value === "object" && value !== null)

const readHost = (options: object): string | undefined => {
  if ("host" in options && typeof options.host === "string") {
    return options.host
  }

  if ("hostname" in options && typeof options.hostname === "string") {
    return options.hostname
  }

  return undefined
}

// net.connect() normalizes its arguments and hands them to socket.connect() as one array,
// so the real options can sit one level in. Null means a unix socket, which never leaves
// the machine.
const socketHostname = (first: unknown, second: unknown): string | null => {
  if (Array.isArray(first)) {
    return socketHostname(first[0], first[1])
  }

  if (typeof first === "number") {
    return typeof second === "string" ? second : "localhost"
  }

  if (typeof first === "string") {
    return null
  }

  if (typeof first === "object" && first !== null) {
    const host = readHost(first)
    if (host !== undefined) {
      return host
    }

    // `path` is a unix socket only when there is no host; http options reuse the same
    // object and carry the request path in it.
    return "path" in first ? null : "localhost"
  }

  return null
}

// Monkey patching is mutation by definition, so it lives in one class that owns the
// allowlist and installs every fence exactly once per test worker.
class NetworkGuard {
  private readonly allowedHostnames = new Set(LOCAL_HOSTNAMES)
  private installed = false

  public install(): void {
    if (this.installed) {
      return
    }

    this.installed = true
    for (const key of OUTBOUND_CREDENTIAL_ENV_KEYS) {
      delete process.env[key]
    }

    for (const key of DATABASE_ENV_KEYS) {
      const hostname = hostnameOfConnectionString(process.env[key])
      if (hostname !== null) {
        this.allowedHostnames.add(hostname)
      }
    }

    this.guardFetch()
    this.guardRequest(http)
    this.guardRequest(https)
    this.guardSocketConnect()
  }

  private isAllowed(hostname: string): boolean {
    return this.allowedHostnames.has(hostname.toLowerCase())
  }

  private assertLocal(target: RequestTarget): void {
    const hostname = hostnameOfTarget(target)
    if (!this.isAllowed(hostname)) {
      throw new OutboundRequestBlockedError(hostname)
    }
  }

  private guardFetch(): void {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      this.assertLocal(input instanceof Request ? input.url : input)

      return originalFetch(input, init)
    }
  }

  // Turns a blocked call through the module object into a synchronous, readable error.
  private guardRequest(target: typeof http | typeof https): void {
    const originalRequest = target.request
    Object.defineProperty(target, "request", {
      configurable: true,
      writable: true,
      value: (...args: unknown[]): unknown => {
        const [first] = args
        if (isRequestTarget(first)) {
          this.assertLocal(first)
        }

        return Reflect.apply(originalRequest, target, args)
      },
    })
  }

  // Named imports (`import { request } from "node:https"`, which is how the AWS SDK
  // reaches S3) bind the function before the module object is patched, so the module
  // wrapper alone is not a fence. Every client, undici's fetch included, ends up in
  // net.Socket.prototype.connect, and prototype lookup is dynamic. That is the real gate.
  private guardSocketConnect(): void {
    const originalConnect: unknown = Object.getOwnPropertyDescriptor(net.Socket.prototype, "connect")?.value
    if (typeof originalConnect !== "function") {
      throw new Error("net.Socket.prototype.connect is not patchable")
    }

    const isAllowed = (hostname: string): boolean => this.isAllowed(hostname)
    Object.defineProperty(net.Socket.prototype, "connect", {
      configurable: true,
      writable: true,
      value: function guardedConnect(this: net.Socket, ...args: unknown[]): net.Socket {
        const hostname = socketHostname(args[0], args[1])
        if (hostname !== null && !isAllowed(hostname)) {
          // Destroying instead of throwing: node's http Agent swallows a synchronous
          // throw from createConnection and the request then hangs until the test times
          // out. A destroyed socket surfaces as a normal 'error' on the request.
          const blocked = new OutboundRequestBlockedError(hostname)
          process.nextTick(() => this.destroy(blocked))

          return this
        }

        Reflect.apply(originalConnect, this, args)

        return this
      },
    })
  }
}

const networkGuard = new NetworkGuard()

// Installs the guard for the current test worker. Idempotent, so both the unit and the
// integration setup can call it without ordering rules.
export const installNetworkGuard = (): void => {
  networkGuard.install()
}
