# Feature structure and worked example

Read this alongside architecture.md, coding-conventions.md and tech-stack.md. The example below describes future implementation, not existing shipment endpoints or tables.

## Repository map

```text
src/
├── app/                         # Routing and page composition
│   ├── (storefront)/            # Route group; absent from URL
│   ├── (auth)/                  # Login routes when implemented
│   ├── admin/                   # /admin routes
│   ├── seller/                  # /seller routes
│   └── api/
│       ├── auth/[...all]/       # Better Auth handler (implemented)
│       ├── health/              # Liveness endpoint (implemented)
│       └── v1/                  # Future versioned business JSON API
├── features/                    # Ten team-owned business areas
│   └── logistics/
│       ├── components/          # shipment-status.tsx
│       ├── hooks/               # use-shipment-tracking.ts (if needed)
│       ├── schemas/             # create-shipment.schema.ts
│       ├── types/               # shipment.ts
│       ├── utils/               # format-tracking-number.ts
│       ├── server/
│       │   ├── actions/         # create-shipment.ts
│       │   ├── services/        # shipment-service.ts
│       │   ├── queries/         # get-shipment.ts
│       │   ├── repositories/    # shipment-repository.ts
│       │   └── index.ts         # Public server API; server-only
│       ├── tests/               # shipment-service.test.ts
│       ├── index.ts             # Public client-safe exports
│       └── README.md            # Owner, scope, contracts and owned data
├── shared/
│   ├── components/ui/           # shadcn Button, Input, Label, Card
│   ├── hooks/                   # Reusable browser behavior
│   ├── schemas/                 # Technical schemas such as pagination
│   ├── utils/                   # cn and other pure utilities
│   ├── types/                   # Technical cross-cutting types
│   └── config/                  # Public configuration without secrets
└── server/                      # Shared runtime infrastructure
    ├── auth.ts                  # Better Auth instance
    └── db.ts                    # Prisma client
```

All ten features use the same folder convention. Empty .gitkeep files preserve the initial structure. Add meaningful files as needed; do not create dummy layers just to fill folders. Core commerce models require agreed owners before implementation.

## Naming and imports

```tsx
// components/shipment-status.tsx
export function ShipmentStatus() {
  /* render feature UI */
}
```

```ts
// Allowed: a consumer uses the public server interface.
import { getShipment } from "@/features/logistics/server";
// Allowed: inside Logistics, use local implementation files.
import { shipmentSchema } from "../../schemas/shipment.schema";
// Disallowed from another feature:
// import { shipmentRepository } from "@/features/logistics/server/repositories/shipment-repository";
```

Use kebab-case files, PascalCase components/types and camelCase functions. Reserve index.ts for public exports. Public client entry points must not re-export Prisma, secrets or server APIs. Import shared UI as `@/shared/components/ui/button`; feature-specific UI belongs in the feature.

## Zod example

```ts
import { z } from "zod";

export const createShipmentSchema = z.object({
  orderId: z.string().min(1).max(128),
  shippingMethod: z.enum(["standard", "express"]),
});
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
```

TypeScript helps developers at compile time; Zod checks actual runtime data. Validate browser/API input on the server. The allowed values here are illustrative and need a team contract.

## Request flow

```text
Browser → route handler or Server Action
        → session and permission checks
        → Zod validation
        → feature service
        → repository → Prisma → PostgreSQL
```

For example, a future `POST /api/v1/shipments` handler validates the session using Better Auth, parses JSON (malformed JSON is 400), validates the schema and calls the Logistics public service. The service verifies that this user may fulfill this order and that the order is ready to ship before persisting. The route returns 201 with `{ data: shipment }`. Unauthenticated access is 401; denied access is 403. Never trust a browser-supplied user ID or role.

Session checks alone are insufficient: check order ownership or staff permissions in the service used by every entry point. A UI hiding a button does not authorize the operation.

A server-rendered page calls `getShipment` directly; it does not fetch the application's own HTTP endpoint. Read queries must enforce access rules too. Use transactions where one business operation needs multiple atomic writes. Coordinate cross-feature workflows through documented services, not direct writes to another team's tables.

## Testing and PR example

A shipment service test should show that a customer cannot create staff-only shipments and that an unready order is rejected without persistence. Add a success case and cover retry/idempotency behavior when carrier integration is introduced. Test the rules rather than reproducing method internals.

Use a branch such as `feat/logistics/create-shipment`. In the PR, describe the endpoint and public contract, schema/migration changes, affected teams, and actual test results. Follow review-policy.md for two independent external-group approvals.

## Feature README checklist

Before exposing a feature API, record its owning team, operations, input/output types, authorization rules, domain errors, tables it owns, dependencies and verification commands. Record breaking changes with affected consumers in the same PR.
