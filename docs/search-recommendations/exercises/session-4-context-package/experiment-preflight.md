# Experiment preflight

Status: starters prepared; neither run has started. Pending user response about actual review or permission to disclose a provisional contract.

Identical isolated starters: /tmp/shop-search-exercise-20261025/run-a and run-b. Each contains package.json, tsconfig.json and products.json, but no solution or repository documents. Starting SHA-256 hashes are in the parent folder's starting-hashes.json. The identical task prompts are in that parent folder, outside either agent workspace. The B context is not attached/frozen yet because review may change it.

Codex CLI is available and supports fresh non-resumed `exec` sessions, JSONL event recording, an explicit working folder, and --ignore-user-config. Actual model/settings and inherited instructions must be recorded when the sessions are launched. Fresh CLI sessions must not be represented as ordinary desktop chats if that distinction matters for the professor. No experiment has been run or scored.

Direct installed Vitest check on 25 October 2026: `./node_modules/.bin/vitest run` passed 2 test files / 4 tests. These are existing repository tests, not the unimplemented experiment. The previous pnpm wrapper problem remains separate.
