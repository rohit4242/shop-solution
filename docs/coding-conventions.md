# Coding conventions

- TypeScript strict mode; avoid any and explain justified exceptions.
- kebab-case filenames, PascalCase components/types, camelCase functions/variables. Follow Next.js special filenames.
- Server Components by default; use client components for browser state and interactions.
- Validate untrusted input with Zod at server boundaries. Authorize resource access on the server.
- Use @/ imports after configuring the alias; consume feature public entry points.
- Use Tailwind and shared UI primitives. Keep feature-specific UI in its feature.
- Keep actions thin; put business rules in services. Add repository abstractions when they clarify persistence, not as mandatory pass-through layers.
- Return consistent domain errors; log internal details server-side without secrets or personal data.
- Keep money in integer minor units with currency; agree VAT and rounding rules with Accounting before implementation.
- Store timestamps consistently and format for the user at the UI boundary.
- Add meaningful tests for business rules and permissions; use end-to-end tests for critical journeys.
- Prettier owns formatting; ESLint owns static rules. Configured in the repository.
- Document environment variable names in .env.example; never commit credentials.
- New dependencies and contract changes must be explained in PRs.
