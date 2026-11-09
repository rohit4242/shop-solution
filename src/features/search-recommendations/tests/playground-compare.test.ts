import { it, expect } from "vitest";
import { compareRuns } from "../utils/compare-playground-runs";
import { settingsSchema, type SavedRun } from "../schemas/playground";
it("highlights changed settings and arguments without inventing usage", () => {
  const a: SavedRun = {
    id: "a",
    createdAt: "2026-11-09",
    settings: settingsSchema.parse({ modelId: "model" }),
    messages: [{ role: "user", content: "Search" }],
    events: [],
    answer: "No matches",
    outcome: "completed",
    exported: false,
  };
  const b = {
    ...a,
    id: "b",
    settings: { ...a.settings, maxSteps: 4 },
    events: [
      {
        runId: "b",
        seq: 0,
        time: "2026-11-09",
        step: 1,
        type: "tool-call",
        data: { name: "search", arguments: { q: "mouse" } },
      },
    ],
  };
  const rows = compareRuns(a, b);
  expect(rows.find((r) => r.label === "Configuration")?.changed).toBe(true);
  expect(
    rows.find((r) => r.label === "Tool sequence and arguments")?.changed,
  ).toBe(true);
  expect(rows.find((r) => r.label === "Final answer")?.changed).toBe(false);
  expect(rows.find((r) => r.label === "Reported usage")?.left).toBe(
    "Not reported",
  );
});
