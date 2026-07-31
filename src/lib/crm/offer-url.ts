// A deal can carry a link to the offer document that was sent to the client. The link
// is stored twice: verbatim for display, and canonical for lookups, so the same offer
// pasted with a trailing slash or a tracking query still resolves to one deal.

// Canonical form: lowercase host, query and hash dropped, trailing slash trimmed. The
// path stays case-sensitive because offer slugs are. Returns null for anything that
// does not parse as a URL.
export function normalizeOfferUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  let path = url.pathname
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1)
  }
  if (path === "/") {
    path = ""
  }
  return `${url.protocol}//${host}${path}`
}
