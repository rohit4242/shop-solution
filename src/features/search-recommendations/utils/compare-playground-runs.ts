import type { SavedRun } from "../schemas/playground";
function summary(run: SavedRun) {
  const steps = run.events
    .filter((e) => e.type === "step-finish")
    .map((e) => e.data as { durationMs?: number });
  const durations = steps
    .map((e) => e.durationMs)
    .filter((v): v is number => typeof v === "number");
  const finish = [...run.events].reverse().find((e) => e.type === "finish")
    ?.data as { usage?: unknown } | undefined;
  return {
    Configuration: run.settings,
    "Input messages": run.messages,
    "Tool sequence and arguments": run.events
      .filter((e) => e.type === "tool-call")
      .map((e) => e.data),
    "Final answer": run.answer,
    Outcome: run.outcome,
    "Measured step duration": durations.length
      ? `${durations.reduce((sum, n) => sum + n, 0)} ms`
      : "Not reported",
    "Reported usage": finish?.usage ?? "Not reported",
  };
}
export function compareRuns(left: SavedRun, right: SavedRun) {
  const a = summary(left),
    b = summary(right);
  const text = (value: unknown) =>
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (Object.keys(a) as (keyof typeof a)[]).map((label) => ({
    label,
    left: text(a[label]),
    right: text(b[label]),
    changed: JSON.stringify(a[label]) !== JSON.stringify(b[label]),
  }));
}
