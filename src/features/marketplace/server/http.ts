import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { readActor, type Actor } from "./access";
import { MarketplaceError, forbidden, invalid } from "./errors";

// Thin HTTP layer for the /api/v1/marketplace route handlers:
// session → validation → service → { data } or { error }.

export type RouteContext<P extends string = never> = {
  params: Promise<Record<P, string>>;
};

export const ok = (data: unknown, status = 200) =>
  NextResponse.json(
    { data },
    { status, headers: { "Cache-Control": "no-store" } },
  );

const failure = (
  status: number,
  code: string,
  message: string,
  fieldErrors?: unknown,
) =>
  NextResponse.json(
    { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } },
    { status, headers: { "Cache-Control": "no-store" } },
  );

function zodFailure(error: z.ZodError) {
  const flat = z.flattenError(error);
  const first = error.issues[0];
  const where = first?.path.length ? `${first.path.join(".")}: ` : "";
  return failure(
    400,
    "VALIDATION_ERROR",
    `${where}${first?.message ?? "Invalid input."}`,
    {
      ...flat.fieldErrors,
      ...(flat.formErrors.length ? { _: flat.formErrors } : {}),
    },
  );
}

/** Runs a handler and turns domain, validation and unexpected errors into the contract shape. */
export function route<C>(
  handler: (request: Request, context: C) => Promise<Response>,
) {
  return async (request: Request, context: C) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof MarketplaceError)
        return failure(
          error.status,
          error.code,
          error.message,
          error.fieldErrors,
        );
      if (error instanceof z.ZodError) return zodFailure(error);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      )
        return failure(
          409,
          "CONCURRENT_UPDATE",
          "Another change happened at the same time. Try again.",
        );
      console.error(
        "[marketplace]",
        request.method,
        new URL(request.url).pathname,
        error,
      );
      return failure(
        500,
        "INTERNAL_ERROR",
        "Something went wrong on our side. Try again later.",
      );
    }
  };
}

/**
 * The session behind a request. Browser mutations must come from this site
 * (same-origin check), so another site cannot act with a seller's cookie.
 */
export async function actorOf(request: Request): Promise<Actor | null> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== new URL(request.url).host)
      throw forbidden("Requests must come from this site.");
  }
  return readActor(request.headers);
}

export async function jsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const body: unknown = await request.json().catch(() => {
    throw invalid("The request body must be valid JSON.");
  });
  return schema.parse(body);
}

export function queryOf<T>(request: Request, schema: z.ZodType<T>): T {
  const entries = [...new URL(request.url).searchParams].filter(
    ([, value]) => value !== "",
  );
  return schema.parse(Object.fromEntries(entries));
}

export const param = <T>(schema: z.ZodType<T>, value: string): T =>
  schema.parse(value);
