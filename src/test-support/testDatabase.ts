// Integration tests write real rows, so they may only ever run against a database whose
// name ends in `_test`. Shared by the per-file setup and the global setup
// of the integration suite.
export const assertTestDatabaseUrl = (connectionString: string | undefined): string => {
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL is not set")
  }

  if (!new URL(connectionString).pathname.slice(1).endsWith("_test")) {
    throw new Error("Integration tests refuse to run outside a database ending in _test")
  }

  return connectionString
}
