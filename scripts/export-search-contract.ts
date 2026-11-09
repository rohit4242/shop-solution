// Writes the Search & Recommendations contract files from the Zod schemas:
//   docs/search-recommendations/openapi.yaml
//   .claude/skills/shop-search/SKILL.md and .agents/skills/shop-search/SKILL.md
// `--check` fails instead of writing when a committed file is out of date.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { stringify, parse } from "yaml";
import { format } from "prettier";
import { createOpenApiDocument } from "../src/features/search-recommendations/docs/openapi";
import {
  agentSkill,
  skillPaths,
} from "../src/features/search-recommendations/docs/agent-kit";

const openApiPath = "docs/search-recommendations/openapi.yaml";
const document = createOpenApiDocument();
// The committed skill has no fixed URL: it tells the agent to use localhost or the team's deployment.
const skill = await format(agentSkill(null), { parser: "markdown" });
const read = (path: string) => {
  try {
    return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  } catch {
    return null;
  }
};

if (process.argv.includes("--check")) {
  const stale = [
    JSON.stringify(parse(read(openApiPath) ?? "")) !== JSON.stringify(document)
      ? openApiPath
      : null,
    ...skillPaths.map((path) => (read(path) !== skill ? path : null)),
  ].filter(Boolean);
  if (stale.length)
    throw new Error(
      `Out of date: ${stale.join(", ")}. Run pnpm contract:export and commit the result.`,
    );
  console.log("openapi.yaml and both shop-search skills match the schemas.");
} else {
  writeFileSync(
    openApiPath,
    await format(stringify(document), { parser: "yaml" }),
  );
  for (const path of skillPaths) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, skill);
  }
  console.log(`Wrote ${openApiPath} and ${skillPaths.join(", ")}.`);
}
