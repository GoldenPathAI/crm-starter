import type { Config } from "drizzle-kit"

export default {
  schema: "./src/lib/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["crm"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config
