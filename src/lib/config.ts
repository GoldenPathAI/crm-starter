// Everything the app needs to know about itself that is NOT a secret. Env vars are
// reserved for credentials; anything a reader could see in a screenshot belongs here.
export const config = {
  appName: "CRM",
  // Subtitle on the login screen. A fork replaces it together with appName and the
  // BrandMark glyph, which is the whole branding surface outside globals.css.
  appTagline: "Klienti, obchody a projekty",
  defaultPageSize: 25,
  // Business timezone. Every "today" the app reasons about (úkoly due today, overdue
  // badges, dashboard columns) is resolved in this zone, not in the server's.
  timezone: "Europe/Prague",
  locale: "cs-CZ",
  currency: "CZK",
  // Runtime deploy id, read server-side only. The app layout renders it into the page
  // and /api/version reports the live value; a stale tab sees the two diverge after a
  // deploy and reloads. "dev" locally keeps the guard inert. Read at request time on
  // the server, never build-inlined, so build and runtime agree.
  deployId: (): string =>
    process.env.RAILWAY_DEPLOYMENT_ID ??
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "dev",
  authBaseUrl:
    process.env.NODE_ENV === "production" ? "https://crm.example.com" : "http://localhost:4325",
  // Sender of invitation and password-reset mail. Must be a verified Resend domain.
  emailFrom: "CRM <crm@example.com>",
  // Private S3 bucket for document files. Access is presigned-only; the AWS credentials
  // are secrets from the default provider chain (env in production, AWS_PROFILE
  // locally), never hardcoded. Bucket and region are routing config.
  files: {
    bucket: "crm-files",
    region: "eu-central-1",
    maxUploadBytes: 25 * 1024 * 1024,
    presignExpirySeconds: 300,
  },
} as const
