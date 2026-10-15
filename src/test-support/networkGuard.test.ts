import { createServer } from "node:http"
import https, { request as httpsRequest } from "node:https"
import { connect } from "node:net"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { sendTransactionalEmail } from "@/lib/email/resend"
import { OutboundRequestBlockedError } from "@/test-support/networkGuard"

// The guard is installed by src/test-support/setupUnit.ts for every test file. This
// suite is the proof that it holds, because everything else depends on it silently.

const errorOf = (start: (onError: (error: Error) => void) => void): Promise<Error | null> =>
  new Promise((resolve) => {
    start(resolve)
    setTimeout(() => resolve(null), 3_000)
  })

describe("outbound network guard", () => {
  it("blocks fetch to the outside world", async () => {
    await expect(fetch("https://api.resend.com/emails")).rejects.toBeInstanceOf(
      OutboundRequestBlockedError,
    )
  })

  it("blocks node:https requests through the module object", () => {
    expect(() => https.request("https://s3.eu-central-1.amazonaws.com/bucket")).toThrow(
      OutboundRequestBlockedError,
    )
  })

  // A named import binds the function before the module object is patched, so this is
  // the path that matters: it is how the AWS SDK and most clients issue requests.
  it("blocks a request issued through a named import", async () => {
    const error = await errorOf((onError) => {
      const request = httpsRequest("https://api.resend.com/emails")
      request.on("error", onError)
      request.end()
    })

    expect(error).toBeInstanceOf(OutboundRequestBlockedError)
  })

  it("blocks a raw socket to a remote host", async () => {
    const error = await errorOf((onError) => {
      const socket = connect({ host: "api.resend.com", port: 443 })
      socket.on("error", onError)
    })

    expect(error).toBeInstanceOf(OutboundRequestBlockedError)
  })

  it("strips the outbound credentials from the process", () => {
    expect(process.env.RESEND_API_KEY).toBeUndefined()
    expect(process.env.INTERNAL_API_TOKEN).toBeUndefined()
    expect(process.env.AWS_ACCESS_KEY_ID).toBeUndefined()
    expect(process.env.AWS_SECRET_ACCESS_KEY).toBeUndefined()
  })

  it("keeps a transactional e-mail from leaving even with a key present", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key")
    try {
      const result = await sendTransactionalEmail({
        to: "someone@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      })

      expect(result.sent).toBe(false)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe("local traffic", () => {
  const server = createServer((_request, response) => {
    response.writeHead(200)
    response.end("ok")
  })

  const baseUrl = (): string => {
    const address = server.address()
    if (address === null || typeof address === "string") {
      throw new Error("The stub server is not listening on a TCP port")
    }

    return `http://127.0.0.1:${address.port}`
  }

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve)
    })
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)))
    })
  })

  // Local stubs and a local headless browser must stay reachable.
  it("lets a test reach its own local server", async () => {
    const response = await fetch(baseUrl())

    expect(await response.text()).toBe("ok")
  })
})
