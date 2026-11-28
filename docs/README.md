# Project documentation

Start with the [repository README](../README.md) to run the app locally. Each team keeps its setup and public contract in its feature README. Find the teams you work with in the [team directory](team-ownership.md).

## Find a guide

| Task                                | Guide                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Open or review a PR                 | [Contribution guide](contribution-guide.md) · [Cross-group review policy](review-policy.md) |
| Organize or extend a feature        | [Feature guide](feature-guide.md) · [Coding conventions](coding-conventions.md)             |
| Define a cross-team interface       | [Architecture](architecture.md) · [Technology and API conventions](tech-stack.md)           |
| Change shared data                  | [Shop data model](commerce/README.md) · [Prisma rules](../prisma/README.md)                 |
| Change a screen or shared component | [Design system](../DESIGN.md) · [Frontend conventions](constitution.md)                     |
| Check project status                | [Class decisions](class-review.md) · [Verification notes](verification.md)                  |

## Where teams put their docs

| Location                                                    | Content                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/<team>/README.md`                             | Feature entry point, scope, current status, local setup, public operations, permissions, shared data, consumers, and verification commands. |
| `src/features/<team>/api/` or an existing contract location | Machine-readable OpenAPI and contract source files. Keep the feature README link current.                                                   |
| `src/features/<team>/docs/`                                 | Additional feature runbooks, examples, and integration notes.                                                                               |
| `docs/`                                                     | Shared guides and the integration plan. Record accepted cross-team decisions in `docs/decisions/`.                                          |
| Team exercise folders                                       | Course submissions and historical evidence. Link to these separately from the current contract.                                             |

Use the [feature README template](templates/feature-readme.md) when starting or expanding a feature guide. Maintain each fact in one place and link to it. When you change a public route, exported operation, schema, setup command, or permission rule, update the affected contract. Add examples or migration notes when a consumer needs them and link the updated docs in your PR.

## Documentation checks

Run `pnpm docs:check` locally. CI runs the same command in the quality job. It checks that each feature folder has a nonempty README and that relative inline links in maintained project and feature docs resolve. It skips external URLs, link anchors, and archived exercises.

On PRs, it also looks for changes to public feature exports, API route handlers with a known team, and OpenAPI files. If those changes have no accompanying team documentation, it adds a warning. Reviewers decide whether the behavior or contract changed and whether the documentation is sufficient.
