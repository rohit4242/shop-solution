import { NextResponse } from "next/server";
import { logisticsSession, validOrigin } from "@/features/logistics/server";
import {
  createSchema,
  updateSchema,
  filterSchema,
} from "@/features/logistics/server";
export const runtime = "nodejs";
const fail = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status });
async function handle(
  request: Request,
  context: { params: Promise<{ parts?: string[] }> },
) {
  if (request.method === "POST" && !validOrigin(request))
    return fail(403, "FORBIDDEN", "Invalid origin");
  if (!(await logisticsSession()))
    return fail(
      401,
      "UNAUTHENTICATED",
      "A Logistics staff session is required",
    );
  const { parts = [] } = await context.params;
  const item = parts.length >= 1 && /^S-[0-9]{4,}$/.test(parts[0]);
  const allowed =
    request.method === "GET"
      ? parts.length === 0 ||
        (item &&
          (parts.length === 1 || (parts.length === 2 && parts[1] === "events")))
      : parts.length === 0 ||
        (item && parts.length === 2 && parts[1] === "status-updates");
  if (!allowed)
    return fail(
      422,
      "VALIDATION_ERROR",
      "Unknown operation or invalid Shipment ID",
    );
  const url = new URL(request.url);
  if (
    request.method === "GET" &&
    !(parts.length === 0 ? filterSchema : filterSchema.pick({})).safeParse(
      Object.fromEntries(url.searchParams),
    ).success
  )
    return fail(422, "VALIDATION_ERROR", "Invalid query parameters");
  let body: string | undefined;
  if (request.method === "POST") {
    const data = await request.json().catch(() => null);
    const result = (parts.length === 0 ? createSchema : updateSchema).safeParse(
      data,
    );
    if (!result.success)
      return fail(422, "VALIDATION_ERROR", "Invalid request body");
    body = JSON.stringify(result.data);
  }
  const base = process.env.LOGISTICS_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(
      `${base}/shipments${parts.length ? "/" + parts.join("/") : ""}${url.search}`,
      {
        method: request.method,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: {
          "Content-Type": "application/json",
          ...(process.env.LOGISTICS_API_TOKEN
            ? { Authorization: `Bearer ${process.env.LOGISTICS_API_TOKEN}` }
            : {}),
        },
      },
    );
    return NextResponse.json(await response.json(), {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return fail(
      503,
      "SERVICE_UNAVAILABLE",
      "The Logistics API could not be reached",
    );
  }
}
export { handle as GET, handle as POST };
