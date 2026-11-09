import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import {
  saveRun,
  listRuns,
  deleteRun,
  clearHistory,
  savePreset,
  listPresets,
} from "../utils/playground-history";
import { settingsSchema, type SavedRun } from "../schemas/playground";
const run = (id: string): SavedRun => ({
  id,
  createdAt: new Date().toISOString(),
  settings: settingsSchema.parse({ modelId: "test" }),
  messages: [{ role: "user", content: "test" }],
  events: [],
  answer: "",
  outcome: "completed",
  exported: false,
});
it("isolates accounts, persists runs, and supports explicit deletion", async () => {
  await saveRun("alice", run("1"));
  await saveRun("bob", run("2"));
  expect((await listRuns("alice")).map((r) => r.id)).toEqual(["1"]);
  await deleteRun("alice", "1");
  expect(await listRuns("alice")).toEqual([]);
  expect((await listRuns("bob")).length).toBe(1);
  await clearHistory("bob");
});
it("refuses eviction at the run limit and validates presets", async () => {
  for (let i = 0; i < 50; i++) await saveRun("limit", run(String(i)));
  await expect(saveRun("limit", run("51"))).rejects.toThrow(/Export/);
  expect((await listRuns("limit")).length).toBe(50);
  await savePreset("limit", {
    id: "preset",
    name: "Example",
    settings: run("1").settings,
  });
  expect((await listPresets("limit"))[0].name).toBe("Example");
  await clearHistory("limit");
  expect(await listPresets("limit")).toEqual([]);
});
