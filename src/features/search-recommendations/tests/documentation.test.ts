import { describe, it, expect } from "vitest";
import { endpointDefinitions, docPages } from "../docs/registry";
import { createOpenApiDocument } from "../docs/openapi";
import { createDiscoveryApi } from "../server/services/api";
import {
  mockOfferSource,
  mockPurchaseSource,
} from "../server/repositories/mock-sources";
import { GET as searchRoute } from "@/app/api/v1/search/route";
import { GET as facetsRoute } from "@/app/api/v1/search/facets/route";
import { GET as autocompleteRoute } from "@/app/api/v1/search/autocomplete/route";
import { GET as similarRoute } from "@/app/api/v1/recommendations/similar/route";
import { GET as alsoBoughtRoute } from "@/app/api/v1/recommendations/also-bought/route";
const routes = {
  search: searchRoute,
  facets: facetsRoute,
  autocomplete: autocompleteRoute,
  similar: similarRoute,
  "also-bought": alsoBoughtRoute,
};
describe("documentation matches HTTP contracts", () => {
  for (const [operation, endpoint] of Object.entries(endpointDefinitions)) {
    it(`${operation}: example equals actual API response and empty schema is valid`, async () => {
      const api = createDiscoveryApi(mockOfferSource, mockPurchaseSource);
      const key = operation as keyof typeof endpointDefinitions;
      const request = new Request(
        `http://localhost${endpoint.path}?${endpoint.exampleQuery}`,
      );
      const response = await api(key, request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(endpoint.responseSchema.safeParse(body).success).toBe(true);
      expect(body).toEqual(endpoint.example);
      expect(endpoint.responseSchema.safeParse(endpoint.empty).success).toBe(
        true,
      );
      expect(await (await routes[key](request)).json()).toEqual(body);
    });
  }
  it("OpenAPI exposes exactly our GET operations with schema-derived parameters", () => {
    const spec = createOpenApiDocument();
    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths)).toHaveLength(5);
    for (const endpoint of Object.values(endpointDefinitions)) {
      const operation = spec.paths[endpoint.path].get;
      expect(operation.parameters.map((p) => p.name)).toEqual(
        endpoint.parameters.map((p) => p.name),
      );
      for (const parameter of operation.parameters)
        expect(parameter.schema).toBeDefined();
      expect(operation.security).toEqual([]);
    }
    expect(new Set(docPages.map((p) => p.slug)).size).toBe(docPages.length);
  });
});
