import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { DocsContent } from "../components/docs/docs-content";
import { docPages } from "../docs/navigation";
import { docsOrigin, openApiYamlResponse } from "../server/docs";

// The /docs/marketing site: every page in the menu has content, and the served contract is the source file.

describe("Marketing docs", () => {
  it.each(docPages.map((p) => [p.slug || "(overview)", p.slug]))(
    "page %s has content",
    (_label, slug) => {
      expect(DocsContent({ slug })).not.toBeNull();
    },
  );

  it("an unknown page has no content (the route answers 404)", () => {
    expect(DocsContent({ slug: "nope" })).toBeNull();
  });

  it("every API page in the menu is an operation in the contract", () => {
    const contract = parse(
      readFileSync("src/features/marketing/api/openapi.yaml", "utf8"),
    );
    for (const page of docPages.filter((p) => p.path)) {
      const path = page.path!.replace("/api/v1/marketing", "");
      expect(contract.paths).toHaveProperty([path]);
    }
  });

  it("serves openapi.yaml exactly as the source file", async () => {
    const response = await openApiYamlResponse();
    expect(response.headers.get("content-type")).toContain("application/yaml");
    expect(await response.text()).toBe(
      readFileSync("src/features/marketing/api/openapi.yaml", "utf8"),
    );
  });

  it("shows the deployed address on Vercel and localhost elsewhere", () => {
    expect(
      docsOrigin({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "shop.example",
      }),
    ).toBe("https://shop.example");
    expect(docsOrigin({ VERCEL_URL: "preview.example" })).toBe(
      "https://preview.example",
    );
    expect(docsOrigin({})).toBe("http://localhost:3000");
  });
});
