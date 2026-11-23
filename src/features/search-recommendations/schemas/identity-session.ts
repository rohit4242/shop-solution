import { z } from "zod";

export const identitySessionStatusSchema = z.discriminatedUnion(
  "authenticated",
  [
    z.object({
      authenticated: z.literal(true),
      email: z.string(),
      displayName: z.string(),
    }),
    z.object({
      authenticated: z.literal(false),
    }),
  ],
);
