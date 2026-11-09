// Writes docs/search-recommendations/openapi.yaml from the Zod schemas.
// `--check` fails instead of writing when the committed file is out of date.
import { readFileSync, writeFileSync } from "node:fs";
import { stringify, parse } from "yaml";
import { format } from "prettier";
import { createOpenApiDocument } from "../src/features/search-recommendations/docs/openapi";

const destination = "docs/search-recommendations/openapi.yaml";
const document = createOpenApiDocument();

if (process.argv.includes("--check")) {
  const committed = parse(readFileSync(destination, "utf8"));
  if (JSON.stringify(committed) !== JSON.stringify(document))
    throw new Error(
      `${destination} is out of date. Run pnpm contract:export and commit the result.`,
    );
  console.log(`${destination} matches the schemas.`);
} else {
  writeFileSync(
    destination,
    await format(stringify(document), { parser: "yaml" }),
  );
  console.log(`Wrote ${destination}.`);
}
