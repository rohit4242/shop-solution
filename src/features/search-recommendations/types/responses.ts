import type { z } from "zod";
import type {
  searchResponseSchema,
  facetsResponseSchema,
  autocompleteResponseSchema,
  recommendationsResponseSchema,
  errorResponseSchema,
  searchQuerySchema,
  facetsQuerySchema,
  autocompleteQuerySchema,
  recommendationQuerySchema,
} from "../schemas/contracts";
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type FacetsResponse = z.infer<typeof facetsResponseSchema>;
export type AutocompleteResponse = z.infer<typeof autocompleteResponseSchema>;
export type RecommendationsResponse = z.infer<
  typeof recommendationsResponseSchema
>;
export type ApiErrorResponse = z.infer<typeof errorResponseSchema>;
// Wire query values are strings; omitted values use the documented server defaults.
export type SearchQueryParams = z.input<typeof searchQuerySchema>;
export type FacetsQueryParams = z.input<typeof facetsQuerySchema>;
export type AutocompleteQueryParams = z.input<typeof autocompleteQuerySchema>;
export type RecommendationQueryParams = z.input<
  typeof recommendationQuerySchema
>;
