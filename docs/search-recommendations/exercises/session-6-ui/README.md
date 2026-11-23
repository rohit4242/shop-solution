# Session 6: Search & Recommendations UI

The developer-facing discovery workbench is available at
`/docs/search-recommendations/discover`. It uses this application's public,
mock-backed API; no database is required. Search remains usable without the
Admin & Identity services. To display the shared login status, the Admin &
Identity API must be running at `http://localhost:8000`; use its UI at
`http://localhost:5500/` to sign in.

From the repository root, run `corepack pnpm install --frozen-lockfile` once,
then `corepack pnpm dev` and open
http://localhost:3000/docs/search-recommendations/discover.
The shared application and its Search & Recommendations API start with that
single command. Admin & Identity remains a separate service.

Run the browser checks with `corepack pnpm test:e2e`. New captures go to the
Playwright test output. The original four main-screen states are saved in
[`screenshots/`](screenshots/):
[empty](screenshots/empty.png), [loading](screenshots/loading.png),
[error](screenshots/error.png), and [success](screenshots/success.png). The
project-level startup instructions remain in the
[root README](../../../../README.md).
