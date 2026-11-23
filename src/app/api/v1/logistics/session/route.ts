import { NextResponse } from "next/server";
import {
  cookieName,
  demoMode,
  logisticsSession,
  sameSecret,
  validOrigin,
} from "@/features/logistics/server";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json(
    { user: await logisticsSession(), demo: demoMode() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!validOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (
    !demoMode() ||
    !process.env.LOGISTICS_DEMO_TOKEN ||
    !process.env.LOGISTICS_DEMO_PASSWORD
  )
    return NextResponse.json(
      { error: "Use the common identity login." },
      { status: 403 },
    );
  const body = await request.json().catch(() => null);
  if (
    body?.email !== "staff@logistics.demo" ||
    typeof body?.password !== "string" ||
    !sameSecret(body.password, process.env.LOGISTICS_DEMO_PASSWORD)
  )
    return NextResponse.json(
      { error: "Incorrect demo email or password." },
      { status: 401 },
    );
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, process.env.LOGISTICS_DEMO_TOKEN, {
    httpOnly: true,
    sameSite: "strict",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}
export async function DELETE(request: Request) {
  if (!validOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(cookieName);
  return response;
}
