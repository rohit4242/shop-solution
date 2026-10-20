# storefront

Scope: Shop navigation, product presentation and cart UI.

Status: proposed team boundary; no business functionality implemented.

Read ../../../docs/architecture.md and ../../../docs/coding-conventions.md.

## Folder responsibilities

- components: feature UI.
- hooks: client React hooks, only when needed.
- server/actions: thin server entry points; authenticate, authorize and validate input.
- server/services: business rules and workflows.
- server/queries: read use cases; use repositories where useful.
- server/repositories: feature-owned persistence access.
- schemas: Zod input validation.
- types: feature-specific types.
- utils: pure helpers.
- tests: meaningful feature tests.

## Integration contract

No public operations or owned tables have been agreed yet. Before implementation, document exported operations, inputs, outputs, authorization, errors and owned data here. Consumers import index.ts or server/index.ts, never internals.

## Ownership

The matching class team owns this area. GitHub handles and reviewers will be assigned after class agreement.
