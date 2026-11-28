// Writes src/features/marketplace/api/openapi.yaml from the Marketplace Zod schemas.
// Run: node --import tsx scripts/export-marketplace-contract.ts
// src/features/marketplace/tests/contract.test.ts fails when the committed file is stale.
import { writeFileSync } from "node:fs";
import { stringify } from "yaml";
import { format } from "prettier";
import { createMarketplaceOpenApi } from "../src/features/marketplace/api/openapi";

const path = "src/features/marketplace/api/openapi.yaml";
const header =
  "# Generated from src/features/marketplace/api/openapi.ts. Do not edit by hand.\n" +
  "# Regenerate: node --import tsx scripts/export-marketplace-contract.ts\n";
const yaml = await format(header + stringify(createMarketplaceOpenApi()), {
  parser: "yaml",
});
writeFileSync(path, yaml);
console.log(`Wrote ${path}`);
