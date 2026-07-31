import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { apiRateLimits } from "@/lib/db/schema/crm";

export interface FixedWindowRateLimit {
  limit: number;
  windowMs: number;
}

export async function consumeRateLimit(
  key: string,
  rule: FixedWindowRateLimit,
  now: Date = new Date(),
): Promise<boolean> {
  const cutoff = new Date(now.getTime() - rule.windowMs).toISOString();
  const current = now.toISOString();
  const rows = await db
    .insert(apiRateLimits)
    .values({ key, windowStartedAt: now, count: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: apiRateLimits.key,
      set: {
        windowStartedAt: sql`CASE
          WHEN ${apiRateLimits.windowStartedAt} <= ${cutoff}::timestamptz THEN ${current}::timestamptz
          ELSE ${apiRateLimits.windowStartedAt}
        END`,
        count: sql`CASE
          WHEN ${apiRateLimits.windowStartedAt} <= ${cutoff}::timestamptz THEN 1
          ELSE ${apiRateLimits.count} + 1
        END`,
        updatedAt: now,
      },
    })
    .returning({ count: apiRateLimits.count });
  return (rows[0]?.count ?? rule.limit + 1) <= rule.limit;
}

const clientFingerprint = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded ?? request.headers.get("x-real-ip") ?? "unavailable";
  return createHash("sha256").update(address).digest("hex");
};

export async function allowPublicRequest(
  request: Request,
  bucket: string,
  clientRule: FixedWindowRateLimit,
  globalRule: FixedWindowRateLimit,
): Promise<boolean> {
  const fingerprint = clientFingerprint(request);
  const [clientAllowed, globalAllowed] = await Promise.all([
    consumeRateLimit(`${bucket}:client:${fingerprint}`, clientRule),
    consumeRateLimit(`${bucket}:global`, globalRule),
  ]);
  return clientAllowed && globalAllowed;
}
