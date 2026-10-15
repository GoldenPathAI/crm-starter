import { NextResponse } from "next/server";
import { z } from "zod";
import { readLimitedText } from "@/lib/http/body";
import { allowPublicRequest, consumeRateLimit } from "@/lib/http/rate-limit";
import { createServerLogger } from "@/lib/logger";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const logger = createServerLogger({ layer: "api", module: "client-errors" });

// Errors can fire before auth resolves, so the endpoint takes unauthenticated posts.
// Shared DB limits protect both the server log and the hourly alert budget across
// every running instance.
const MAX_BODY_BYTES = 32 * 1024;
const reportSchema = z.object({
  message: z.string().min(1).max(500),
  stack: z.string().max(4000).optional().default(""),
  source: z.string().max(100).optional().default(""),
  url: z.string().max(300).optional().default(""),
});

const parseReport = (raw: string): z.infer<typeof reportSchema> | null => {
  try {
    const parsed = reportSchema.safeParse(JSON.parse(raw));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const allowed = await allowPublicRequest(
      request,
      "client-errors",
      { limit: 10, windowMs: 60_000 },
      { limit: 100, windowMs: 60_000 },
    );
    if (!allowed) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "client error rate limit unavailable",
    );

    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const raw = await readLimitedText(request, MAX_BODY_BYTES);
  if (raw === null) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = parseReport(raw);
  if (parsed === null) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const report = {
    ...parsed,
    userAgent: request.headers.get("user-agent")?.slice(0, 200) ?? "",
  };

  logger.error(report, "client-side error reported");

  let alertAllowed = false;
  try {
    alertAllowed = await consumeRateLimit("client-errors:alerts", {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "client error alert throttle unavailable",
    );
  }

  if (alertAllowed) {
    console.error(
      `CRM client error: ${report.message.slice(0, 120)}\n${report.url}\n${report.stack.slice(0, 800)}`,
      { source: report.source, userAgent: report.userAgent },
    );
  }

  return NextResponse.json({ ok: true });
}
