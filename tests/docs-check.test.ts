import { describe, expect, it } from "vitest";
import { relativeLinks, teamsMissingDocs } from "../scripts/check-docs";

describe("documentation check", () => {
  it("finds relative inline links and images outside examples", () => {
    const markdown = [
      "[Feature](../src/features/logistics/README.md#setup)",
      "[Route](../src/app/(storefront)/page.tsx)",
      "![Screenshot](<screenshots/Sign in.png>)",
      "[Web](https://example.test) [Heading](#setup) [Route](/docs)",
      "`[Inline example](not-a-file.md)`",
      "```md",
      "[Example](also-not-a-file.md)",
      "```",
    ].join("\n");
    expect(relativeLinks(markdown)).toEqual([
      { target: "../src/features/logistics/README.md#setup", line: 1 },
      { target: "../src/app/(storefront)/page.tsx", line: 2 },
      { target: "screenshots/Sign in.png", line: 3 },
    ]);
  });

  it("maps route, OpenAPI, and exported interface changes to their teams", () => {
    const teams = new Set(["logistics", "marketing", "search-recommendations"]);
    const changes = [
      { path: "src/features/logistics/server/index.ts", deleted: true },
      { path: "src/features/logistics/README.md", deleted: true },
      { path: "src/app/api/v1/marketing/promotions/route.ts" },
      { path: "docs/marketing/CHANGELOG.md" },
      { path: "src/app/api/v1/recommendations/similar/route.ts" },
      { path: "docs/search-recommendations/openapi.yaml" },
      { path: "docs/search-recommendations/exercises/README.md" },
    ];
    expect(teamsMissingDocs(changes, teams)).toEqual([
      "logistics",
      "search-recommendations",
    ]);
  });

  it("does not ask for docs for internal code or unknown route owners", () => {
    const teams = new Set(["logistics"]);
    expect(
      teamsMissingDocs(
        [
          { path: "src/features/logistics/server/services/tracking.ts" },
          { path: "src/app/api/v1/unassigned/route.ts" },
          { path: "src/app/api/auth/[...all]/route.ts" },
        ],
        teams,
      ),
    ).toEqual([]);
  });
});
