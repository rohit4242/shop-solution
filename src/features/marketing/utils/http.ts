import { NextResponse } from "next/server";
import { z } from "zod";

// Marketing's response shapes (src/features/marketing/api/openapi.yaml):
//   success: { "data": ... }
//   error:   { "error": { "code": "snake_case", "message": "...", "fieldErrors"?: {...} } }

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(
    { data },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function fail(
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  return NextResponse.json(
    { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function invalidInput(error: z.ZodError, code = "invalid_input") {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(400, code, "The request is not valid.", fieldErrors);
}

/** Malformed JSON becomes a ZodError, so it is answered like any other invalid input (400). */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new z.ZodError([
        { code: "custom", path: [], message: "Invalid JSON." },
      ]);
    }
    throw error;
  }
}
