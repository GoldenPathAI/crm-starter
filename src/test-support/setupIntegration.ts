import { installNetworkGuard } from "@/test-support/networkGuard"
import { assertTestDatabaseUrl } from "@/test-support/testDatabase"

assertTestDatabaseUrl(process.env.DATABASE_URL)
installNetworkGuard()
