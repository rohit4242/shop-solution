# Shared frontend constitution

This document records the cross-team decisions for the shared ERP storefront and the frontend architecture that all teams follow.

## 1. Frontend model

We use one shared frontend for the whole application.

- One application, one login, one navigation, one visual system.
- Users navigate a single ERP shell instead of multiple independent frontends.
- Each team owns the pages and UI for its own module and contributes them into the same application.
- No team should change another team’s module folder without approval from that team.

This matches the repository structure already used in this project:

- One Next.js app under `src/app/`
- Shared UI under `src/shared/`
- Team-owned features under `src/features/<team>/`
- Feature ownership stays in the module folder; cross-feature changes happen through agreed public exports or shared contracts

## 2. Framework and structure

### Chosen stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Shared UI and tokens kept in `src/shared/`

### Folder conventions

Each module owns its own folder and remains separately reviewable.

```text
src/
  app/                  # global shell and routing
  shared/               # design system, utilities, shared UI
  features/
    accounting/
    admin-identity/
    crm/
    logistics/
    marketing/
    marketplace/
    reviews-ratings/
    search-recommendations/
    storefront/
    analytics-reporting/
```

Rules:

- One folder per module.
- Teams own their module folder and public export surface.
- Only the owning team modifies its module unless another team is explicitly asked to collaborate.
- Shared shell and layout changes require review from the frontend group and affected module owners.

## 3. Shared shell

A small frontend group owns the shell and keeps the application coherent.

The shell responsibilities are:

- application layout
- global navigation
- standard page frame and spacing
- login entry screen and route guards
- shared design tokens and reusable UI primitives
- consistency checks for cross-module pages

The frontend group is a coordination body, not an owner of all business logic. Modules keep their own domain features and data contracts.

## 4. Login and auth contract

Admin & Identity provides a simple login flow by the middle of the week.

The temporary contract is a stub with fixed test users, sufficient for frontend integration:

- `POST /login`
- `GET /me`

Until that contract is ready, modules build against a mock of the auth interface rather than blocking on a full backend implementation.

Rules:

- No team invents its own auth UX in isolation.
- The shell owns the login screen and page-level gating.
- Module pages may assume the auth contract is available once Admin & Identity stabilizes it.
- Until the real interface exists, mock responses must be documented and consistent across teams.

## 5. Design system

The frontend group extends the lecture design templates and keeps a common design system for all modules.

Because the lecture files were not present in this repository, we adopt the repository’s existing Next.js + Tailwind conventions and record the design decision here:

- shared spacing, color, typography, and state styles live in the frontend shell / shared UI layer
- all modules use the same tokens and component shapes
- feature-specific UI may extend shared components but should not invent separate visual systems
- modules must not introduce ad hoc colors, spacing scales, or component styles outside the shared design system

This project already has the right foundation for that model:

- shared UI primitives under `src/shared/components/ui/`
- global styling in the app root and Tailwind setup
- one application-wide rendering shell in `src/app/`

## 6. Decision on alternative structure

If the course decides against a single frontend, each team builds its own UI and the Part 4 scope changes accordingly. In that case, the shared shell and central login are no longer mandatory, and module teams must switch to local UI delivery and module-level integration.

For this project, we proceed with the one-frontend decision.

## 7. Ownership summary

- Frontend shell: shared frontend group
- Login and identity: Admin & Identity
- Module pages and flows: each feature team owns its folder
- Design system: shared frontend group with team review input

## 8. Status

This constitution is the current shared agreement for the project and should be updated whenever the team structure or the frontend contract changes.
