# Shared database rules

Use [the application schema](schema.prisma) and its [migration history](migrations/) as the runtime source of truth. The [canonical shop design](../docs/commerce/README.md) explains the models and the remaining feature integration decisions.

- Reuse the shared product, seller offer, customer, and order IDs. Check the existing schema and public contracts before introducing a new model. Add a separate table only when it represents a distinct business record or an agreed derived view.
- Keep each write behind the responsible feature's documented server interface. Check the actor's permission and validate input with Zod. Coordinate shared entities with affected teams and confirm the writer for an unassigned domain before implementing its contract.
- Preserve history using deliberate snapshots, such as the order price and shipping address at purchase. Document the reason for a snapshot or derived value and its source. Use integer minor units and an explicit currency for new commerce data. Keep existing wire formats compatible through agreed adapters.
- Include schema changes, a new migration, and any contract changes in the same PR. Preserve applied migrations. For data-changing work, document the backfill, how to verify record counts and totals, and how to recover if a migration stops partway.
- Generate the client with `pnpm db:generate`. Use `pnpm db:migrate --name describe-change` to generate and apply a development migration against a disposable local database. Validate local rehearsal targets before running commands. Use `pnpm db:deploy` to apply committed migrations to approved environments at the agreed rollout step.
- Rehearse a schema change on an empty database and, where existing data is affected, an upgrade from the previous migration with representative fixtures. Report commands, results, and any unverified environments in the PR. Keep shared or production credentials out of code, logs, and PRs.

Admin & Identity owns the Better Auth models. Changes to identity fields or authorization contracts require its review.
