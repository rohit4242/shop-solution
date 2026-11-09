import { describe, expect, it } from "vitest";
import { agentBrief, agentSkill, mcpInstallSnippets } from "../docs/agent-kit";
import { endpointDefinitions } from "../docs/registry";

const base = "https://shop.example";

describe("agent kit", () => {
  it("brief names every endpoint and every parameter", () => {
    const brief = agentBrief(base);
    for (const endpoint of Object.values(endpointDefinitions)) {
      expect(brief).toContain(`GET ${endpoint.path}`);
      expect(brief).toContain(
        `${base}${endpoint.path}?${endpoint.exampleQuery}`,
      );
      for (const parameter of endpoint.parameters)
        expect(brief).toContain(`\`${parameter.name}\``);
    }
    expect(brief).toContain(`${base}/api/mcp/search-recommendations`);
    expect(brief).toContain("euro cents");
  });

  it("skill has Claude Code frontmatter and falls back to localhost without a URL", () => {
    const skill = agentSkill(null);
    expect(skill).toMatch(/^---\nname: shop-search\ndescription: .+\n---\n/);
    expect(skill).toContain("http://localhost:3000/api/v1/search?q=wireless");
    expect(skill).toContain("pnpm dev");
  });

  it("install snippets all point at the given MCP URL", () => {
    const url = `${base}/api/mcp/search-recommendations`;
    const snippets = mcpInstallSnippets(url);
    expect(snippets.map((s) => s.label)).toEqual([
      "Claude Code",
      "Codex",
      "Cursor",
      "VS Code",
      "Other clients",
    ]);
    for (const snippet of snippets) expect(snippet.code).toContain(url);
    expect(snippets[0].code).toBe(
      `claude mcp add --transport http shop-search ${url}`,
    );
  });
});
