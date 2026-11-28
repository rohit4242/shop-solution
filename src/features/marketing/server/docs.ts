import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Env = Record<string, string | undefined>;

/** The site address shown in the docs: Vercel's own address when deployed, else localhost. */
export function docsOrigin(env: Env = process.env): string {
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** The machine-readable contract, read from its source file (the route is prerendered at build time). */
export async function openApiYamlResponse() {
  const yaml = await readFile(
    join(process.cwd(), "src/features/marketing/api/openapi.yaml"),
    "utf8",
  );
  return new Response(yaml, {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Content-Disposition": 'inline; filename="marketing.openapi.yaml"',
    },
  });
}
