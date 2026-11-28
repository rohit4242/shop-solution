import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { createMarketplaceOpenApi } from "../api/openapi";

// The committed openapi.yaml must equal the generated document, and every
// documented operation must have a route handler (and the other way round).

const document = createMarketplaceOpenApi();
const ROUTES = "src/app/api/v1/marketplace";
const META = ["/openapi.yaml", "/openapi.json"];

const routeFile = (path: string) =>
  `${ROUTES}${path.replace(/\{(\w+)\}/g, "[$1]")}/route.ts`;

const exportedMethods = (file: string) => {
  const match = /export const \{ ([A-Z, ]+) \}/.exec(
    readFileSync(file, "utf8"),
  );
  return (match?.[1] ?? "")
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean)
    .sort();
};

describe("Marketplace OpenAPI contract", () => {
  it("committed api/openapi.yaml is up to date", () => {
    const committed = parse(
      readFileSync("src/features/marketplace/api/openapi.yaml", "utf8"),
    );
    expect(
      committed,
      "Run: node --import tsx scripts/export-marketplace-contract.ts",
    ).toEqual(JSON.parse(JSON.stringify(document)));
  });

  it("every documented path has a route with exactly the documented methods", () => {
    for (const [path, operations] of Object.entries(document.paths)) {
      const file = routeFile(path);
      expect(existsSync(file), `${file} is missing`).toBe(true);
      expect(exportedMethods(file), path).toEqual(
        Object.keys(operations).sort(),
      );
    }
  });

  it("every route is documented", async () => {
    const { globSync } = await import("node:fs");
    const documented = new Set([...Object.keys(document.paths), ...META]);
    const routes = globSync(`${ROUTES}/**/route.ts`).map((file) =>
      file
        .slice(ROUTES.length)
        .replace(/\/route\.ts$/, "")
        .replace(/\[(\w+)\]/g, "{$1}"),
    );
    expect(routes.filter((route) => !documented.has(route))).toEqual([]);
  });

  it("uses unique operation IDs", () => {
    const ids = Object.values(document.paths).flatMap((ops) =>
      Object.values(ops).map(
        (op) => (op as { operationId: string }).operationId,
      ),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
