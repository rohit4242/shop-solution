---
name: create-feature
description: Implement or extend a shop feature using the agreed team boundaries and documented public contracts.
---

Read the repository instructions and target feature README. Identify the owning team and affected consumers. For changes involving unassigned commerce domains, resolve ownership before implementing their public contracts.

Keep routing thin and business rules inside the owning feature. Export client-safe and server APIs separately. Update the feature README when adding operations or data ownership. Add focused tests for business rules and authorization, then run available repository checks and report evidence. Do not add empty abstraction layers or change unrelated features.

Use docs/feature-guide.md as the repository structure and integration example; docs/tech-stack.md explains technology choices.
