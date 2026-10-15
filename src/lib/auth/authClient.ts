import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { config } from "@/lib/config"

export const authClient = createAuthClient({
  baseURL: config.authBaseUrl,
  plugins: [organizationClient()],
})
