import { readFileSync, writeFileSync } from "node:fs";
import { stringify, parse } from "yaml";
import { format } from "prettier";
import { z } from "zod";
import { createOpenApiDocument } from "../src/features/search-recommendations/docs/openapi";
import { toolDefinitions } from "../src/features/search-recommendations/server/mcp/tools";
const destination = "docs/search-recommendations/openapi.yaml";
const toolsPath = "tools/search-recommendations-mcp/tool-contract.json";
const document = createOpenApiDocument();
const tools = Object.fromEntries(
  Object.entries(toolDefinitions).map(([name, value]) => [
    name,
    {
      path: value.path,
      description: value.description,
      inputSchema: z.toJSONSchema(value.schema, { io: "input" }),
    },
  ]),
);
if (process.argv.includes("--check")) {
  if (
    JSON.stringify(parse(readFileSync(destination, "utf8"))) !==
      JSON.stringify(document) ||
    JSON.stringify(JSON.parse(readFileSync(toolsPath, "utf8"))) !==
      JSON.stringify(tools)
  )
    throw new Error(
      "Contract artifacts drifted. Run pnpm contract:export and review changes.",
    );
  console.log("OpenAPI and Python tool contract match the maintained schemas.");
} else {
  writeFileSync(
    destination,
    await format(stringify(document), { parser: "yaml" }),
  );
  writeFileSync(
    toolsPath,
    await format(JSON.stringify(tools), { parser: "json" }),
  );
}
