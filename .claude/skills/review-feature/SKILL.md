---
name: review-feature
description: Review a shop feature change for architecture boundaries, integration contracts and business behavior.
---

Read the repository instructions, diff and affected feature READMEs. Inspect cross-feature imports, server/client boundaries, authorization, validation and persistence ownership. Check public contract changes against callers and migrations against affected modules.

Assess meaningful tests and failure handling. Report concrete findings with file locations, impact and suggested corrections. Distinguish verified failures from uncertainty; say which checks ran. Do not edit implementation or merge as part of a review request.

Use docs/feature-guide.md as the repository structure and integration example; docs/tech-stack.md explains technology choices.
