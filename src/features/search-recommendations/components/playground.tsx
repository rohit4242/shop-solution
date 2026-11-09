"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/features/admin-identity";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  settingsSchema,
  runExportSchema,
  eventSchema,
  type ModelProfile,
  type PlaygroundSettings,
  type SavedRun,
  type Preset,
} from "../schemas/playground";
import {
  listRuns,
  saveRun,
  deleteRun,
  clearHistory,
  listPresets,
  savePreset,
  deletePreset,
} from "../utils/playground-history";
import { compareRuns } from "../utils/compare-playground-runs";
import { PlaygroundSettingsPanel } from "./playground-settings";
const examples = [
  [
    "Happy path",
    "Find in-stock products matching wireless costing at most €25.",
  ],
  ["Unknown product", "Find alternatives to product prd_missing."],
  [
    "Several steps",
    "Search for Wireless Mouse, then compare similar products and also-bought results using the returned product ID.",
  ],
  [
    "No evidence",
    "What products were bought with Desk Speaker, product prd_5?",
  ],
];
const control = "w-full rounded-md border bg-background p-2 text-sm";
type Config = { userId: string; enabled: boolean; profiles: ModelProfile[] };
export function SearchPlayground() {
  const [config, setConfig] = useState<Config | null>(null),
    [gate, setGate] = useState("Checking access…"),
    [error, setError] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [settings, setSettings] = useState<PlaygroundSettings>(
    settingsSchema.parse({ modelId: "unconfigured" }),
  );
  const [forkMessages, setForkMessages] = useState<SavedRun["messages"] | null>(
    null,
  );
  const [prompt, setPrompt] = useState(""),
    [run, setRun] = useState<SavedRun | null>(null),
    [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<SavedRun[]>([]),
    [presets, setPresets] = useState<Preset[]>([]),
    [presetName, setPresetName] = useState("");
  const [tab, setTab] = useState("Conversation"),
    [compareId, setCompareId] = useState(""),
    [presetId, setPresetId] = useState("");
  const [configWidth, setConfigWidth] = useState(280),
    [inspectorWidth, setInspectorWidth] = useState(340);
  const abort = useRef<AbortController | null>(null),
    mounted = useRef(true),
    activeUser = useRef<string | null>(null),
    accessGeneration = useRef(0);
  const resetUserEditors = useCallback(() => {
    activeUser.current = null;
    setConfig(null);
    setRun(null);
    setRuns([]);
    setPresets([]);
    setPrompt("");
    setForkMessages(null);
    setPresetName("");
    setPresetId("");
    setCompareId("");
    setEmail("");
    setPassword("");
    setError("");
    setSettings(settingsSchema.parse({ modelId: "unconfigured" }));
  }, []);
  const loadAccess = useCallback(async () => {
    const generation = ++accessGeneration.current;
    try {
      const response = await fetch("/api/search-playground/config", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!mounted.current || generation !== accessGeneration.current) return;
      resetUserEditors();
      if (!response.ok) {
        setGate(body.error?.message ?? "Access unavailable.");
        return;
      }
      const value = body as Config;
      const [history, savedPresets] = await Promise.all([
        listRuns(value.userId),
        listPresets(value.userId),
      ]);
      if (!mounted.current || generation !== accessGeneration.current) return;
      activeUser.current = value.userId;
      setConfig(value);
      setSettings(
        settingsSchema.parse({
          modelId: value.profiles[0]?.id ?? "unconfigured",
          maxOutputTokens: Math.min(
            1024,
            value.profiles[0]?.maxOutputTokens ?? 1024,
          ),
        }),
      );
      setRuns(history);
      setPresets(savedPresets);
    } catch {
      if (mounted.current && generation === accessGeneration.current) {
        resetUserEditors();
        setGate(
          "Could not load access or browser storage. Check configuration and browser permissions.",
        );
      }
    }
  }, [resetUserEditors]);
  useEffect(() => {
    mounted.current = true;
    // Defer initial loading to the async boundary; all updates follow external I/O.
    void Promise.resolve().then(() => loadAccess());
    const revalidate = () => {
      const generation = accessGeneration.current;
      void fetch("/api/search-playground/config", { cache: "no-store" })
        .then(async (response) => {
          const body = await response.json();
          if (
            mounted.current &&
            generation === accessGeneration.current &&
            activeUser.current &&
            (!response.ok || body.userId !== activeUser.current)
          ) {
            abort.current?.abort();
            accessGeneration.current++;
            resetUserEditors();
            setGate(
              "Session changed. Sign in again to load your local history.",
            );
          }
        })
        .catch(() => {});
    };
    window.addEventListener("focus", revalidate);
    return () => {
      mounted.current = false;
      abort.current?.abort();
      window.removeEventListener("focus", revalidate);
    };
  }, [loadAccess, resetUserEditors]);
  async function persist(value: SavedRun) {
    if (!config) return;
    await saveRun(config.userId, value);
    const history = await listRuns(config.userId);
    if (mounted.current && activeUser.current === config.userId)
      setRuns(history);
  }
  function changeSettings(value: PlaygroundSettings) {
    if (run) {
      setForkMessages(run.messages.slice(0, -1));
      setPrompt(run.messages.at(-1)?.content ?? "");
    }
    setSettings(value);
    setRun(null);
    setCompareId("");
  }
  async function start(text = prompt) {
    if (!config || busy || !text.trim()) return;
    setError("");
    let parsed: PlaygroundSettings;
    try {
      parsed = settingsSchema.parse(settings);
    } catch {
      setError("Check the settings and limits.");
      return;
    }
    const previous =
      forkMessages ??
      (run?.outcome === "completed"
        ? [...run.messages, { role: "assistant" as const, content: run.answer }]
        : []);
    setForkMessages(null);
    const current: SavedRun = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      settings: parsed,
      messages: [...previous, { role: "user", content: text.trim() }],
      events: [],
      answer: "",
      outcome: "connecting",
      exported: false,
    };
    setRun({ ...current });
    setBusy(true);
    const active = new AbortController();
    abort.current = active;
    try {
      const response = await fetch("/api/search-playground/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: parsed, messages: current.messages }),
        signal: active.signal,
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          accessGeneration.current++;
          resetUserEditors();
          setGate("Session expired or access removed. Sign in again.");
        }
        const body = await response.json();
        throw new Error(body.error?.message ?? "Run failed.");
      }
      const reader = response.body!.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      const accept = (line: string) => {
        if (!line.trim()) return;
        const event = eventSchema.parse(JSON.parse(line));
        current.events.push(event);
        if (event.type === "text")
          current.answer += String((event.data as { text: string }).text);
        if (event.type === "finish") {
          current.outcome = (
            event.data as { state: SavedRun["outcome"] }
          ).state;
          finished = true;
        } else if (!finished) current.outcome = "running";
        if (mounted.current && activeUser.current === config.userId)
          setRun({ ...current, events: [...current.events] });
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(accept);
      }
      buffer += decoder.decode();
      if (buffer.trim()) accept(buffer);
      if (!finished) current.outcome = "failed";
    } catch (reason) {
      current.outcome = active.signal.aborted ? "cancelled" : "failed";
      if (!active.signal.aborted && mounted.current)
        setError(reason instanceof Error ? reason.message : "Run failed.");
    } finally {
      if (mounted.current) {
        setBusy(false);
        if (activeUser.current === config.userId)
          setRun({ ...current, events: [...current.events] });
      }
      try {
        await persist(current);
      } catch (reason) {
        if (mounted.current)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not save history. Export this run before leaving.",
          );
      }
    }
  }
  async function exportRun(value: SavedRun) {
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 1, run: { ...value, exported: true } },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `search-run-${value.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    const updated = { ...value, exported: true };
    if (run?.id === value.id) setRun(updated);
    await persist(updated);
  }
  async function perform(action: () => Promise<unknown>) {
    try {
      setError("");
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Operation failed.");
    }
  }
  if (!config)
    return (
      <section className="mx-auto max-w-md space-y-5 py-10">
        <p className="text-xs tracking-widest uppercase text-muted-foreground">
          Team access
        </p>
        <h1 className="text-3xl font-semibold">Search playground</h1>
        <p role="status">{gate}</p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void perform(async () => {
              const result = await authClient.signIn.email({ email, password });
              setPassword("");
              if (result.error)
                throw new Error(result.error.message ?? "Sign-in failed.");
              await loadAccess();
            });
          }}
        >
          <label className="block">
            Email
            <Input
              aria-label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            Password
            <Input
              aria-label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button type="submit">Sign in</Button>
        </form>
        <p className="text-sm text-muted-foreground">
          Accounts require explicit team approval. Public MCP and documentation
          do not require a playground account.
        </p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </section>
    );
  const comparison = runs.find((r) => r.id === compareId);
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-widest uppercase text-muted-foreground">
            Search & recommendations / Team workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Playground
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure an experiment. Follow every tool call. Compare what
            changed.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              await authClient.signOut();
              await loadAccess();
            })
          }
        >
          Sign out
        </Button>
      </header>
      {(!config.enabled || !config.profiles.length) && (
        <p role="status" className="rounded-lg border p-4 text-sm">
          The playground is not configured for live runs. An operator must
          configure model credentials, profiles, the MCP URL, and
          PLAYGROUND_ENABLED.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive p-3 text-sm"
        >
          {error}
        </p>
      )}
      <div role="tablist" aria-label="Workspace panels" className="flex gap-2">
        {["Configuration", "Conversation", "Inspector"].map((name) => (
          <Button
            key={name}
            role="tab"
            aria-selected={tab === name}
            variant={tab === name ? "default" : "outline"}
            onClick={() => setTab(name)}
          >
            {name}
          </Button>
        ))}
      </div>
      <details className="hidden text-xs xl:block">
        <summary>Resize workspace panels</summary>
        <div className="mt-2 flex gap-6">
          <label>
            Configuration width
            <input
              aria-label="Configuration width"
              type="range"
              min={220}
              max={400}
              value={configWidth}
              onChange={(e) => setConfigWidth(Number(e.target.value))}
            />
          </label>
          <label>
            Inspector width
            <input
              aria-label="Inspector width"
              type="range"
              min={260}
              max={500}
              value={inspectorWidth}
              onChange={(e) => setInspectorWidth(Number(e.target.value))}
            />
          </label>
        </div>
      </details>
      <div className="flex flex-col gap-4 xl:flex-row">
        <aside
          style={{ flexBasis: configWidth }}
          className={`${tab === "Configuration" ? "block" : "hidden"} min-w-0 shrink-0 space-y-5 rounded-xl border p-4 xl:block`}
        >
          <h2 className="font-semibold">Configuration</h2>
          <PlaygroundSettingsPanel
            settings={settings}
            profiles={config.profiles}
            onChange={changeSettings}
            disabled={busy}
          />
          <fieldset disabled={busy} className="space-y-2 border-t pt-4">
            <legend className="text-sm font-medium">Presets</legend>
            <Input
              aria-label="Preset name"
              placeholder="Preset name"
              maxLength={80}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!presetName.trim()}
                onClick={() =>
                  void perform(async () => {
                    await savePreset(config.userId, {
                      id: presetId || crypto.randomUUID(),
                      name: presetName,
                      settings,
                    });
                    setPresets(await listPresets(config.userId));
                  })
                }
              >
                Save preset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPresetId("");
                  setPresetName(
                    presetName
                      ? `${presetName} copy`.slice(0, 80)
                      : "New preset",
                  );
                }}
              >
                Duplicate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  changeSettings(
                    settingsSchema.parse({
                      modelId: config.profiles[0]?.id ?? "unconfigured",
                      maxOutputTokens: Math.min(
                        1024,
                        config.profiles[0]?.maxOutputTokens ?? 1024,
                      ),
                    }),
                  );
                  setPresetId("");
                  setPresetName("");
                }}
              >
                Reset
              </Button>
            </div>
            <select
              aria-label="Saved preset"
              className={control}
              value={presetId}
              onChange={(e) => {
                setPresetId(e.target.value);
                const value = presets.find((p) => p.id === e.target.value);
                if (value) {
                  changeSettings(value.settings);
                  setPresetName(value.name);
                }
              }}
            >
              <option value="">Choose a preset</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {presetId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void perform(async () => {
                    await deletePreset(config.userId, presetId);
                    setPresets(await listPresets(config.userId));
                    setPresetId("");
                  })
                }
              >
                Delete preset
              </Button>
            )}
          </fieldset>
        </aside>
        <div
          className={`${tab === "Conversation" ? "block" : "hidden"} min-w-0 flex-1 space-y-4 rounded-xl border p-4 xl:block`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Conversation</h2>
            <span
              data-testid="run-state"
              role="status"
              className="rounded-full bg-muted px-3 py-1 text-xs"
            >
              {run?.outcome ?? "idle"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {examples.map(([label, text]) => (
              <Button
                key={label}
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setPrompt(text);
                  setForkMessages(null);
                  setRun(null);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="min-h-48 space-y-4 rounded-lg bg-muted/40 p-4">
            {run?.messages.map((m, i) => (
              <div key={i}>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {m.role}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {m.content}
                </p>
              </div>
            ))}
            <p
              data-testid="run-answer"
              className="whitespace-pre-wrap break-words text-sm leading-7"
            >
              {run?.answer || "Run a task to see the agent response here."}
            </p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void start();
            }}
          >
            <label className="block text-sm">
              Prompt
              <textarea
                aria-label="Prompt"
                className={control}
                rows={4}
                maxLength={16000}
                value={prompt}
                disabled={busy}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={
                  busy ||
                  !config.enabled ||
                  !config.profiles.length ||
                  !prompt.trim()
                }
              >
                Run
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!busy}
                onClick={() => abort.current?.abort()}
              >
                Stop
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setRun(null);
                  setPrompt("");
                  setForkMessages(null);
                  setCompareId("");
                }}
              >
                New conversation
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !run}
                onClick={() => {
                  setPrompt(run?.messages.at(-1)?.content ?? "");
                  setSettings(run!.settings);
                  setForkMessages(run!.messages.slice(0, -1));
                  setRun(null);
                }}
              >
                Repeat / fork
              </Button>
            </div>
          </form>
          {run && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void perform(() => navigator.clipboard.writeText(run.answer))
                }
              >
                Copy answer
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void perform(() => exportRun(run))}
              >
                Export run
              </Button>
            </div>
          )}
        </div>
        <aside
          style={{ flexBasis: inspectorWidth }}
          className={`${tab === "Inspector" ? "block" : "hidden"} min-w-0 shrink-0 space-y-3 rounded-xl border p-4 xl:block`}
        >
          <h2 className="font-semibold">Inspector</h2>
          <p className="text-xs text-muted-foreground">
            SDK-normalized events, not raw provider traffic. Usage appears only
            when reported. Hidden reasoning and secrets are excluded.
          </p>
          <div className="max-h-[700px] space-y-2 overflow-auto">
            {!run?.events.length && (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            )}
            {run?.events.map((event) => (
              <details key={event.seq} className="rounded-md border p-2">
                <summary className="cursor-pointer text-xs">
                  <span className="mr-2 text-muted-foreground">
                    {event.seq} · step {event.step}
                  </span>
                  <span>{event.type}</span>
                </summary>
                <time className="text-xs text-muted-foreground">
                  {event.time}
                </time>
                <pre className="mt-2 overflow-auto text-xs whitespace-pre-wrap break-all">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        </aside>
      </div>
      <section className="space-y-4 rounded-xl border p-4">
        <h2 className="font-semibold">Local run history</h2>
        <p className="text-sm text-muted-foreground">
          Stored only in this browser, up to 50 runs / 20 presets / 20 MB. Not
          encrypted or shared. Export before deleting. Identical settings do not
          guarantee identical outputs.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            aria-label="Saved run"
            className={control}
            disabled={busy}
            value={run?.id ?? ""}
            onChange={(e) => {
              const saved = runs.find((r) => r.id === e.target.value);
              if (saved) {
                setRun(saved);
                setForkMessages(null);
                setSettings(saved.settings);
              }
            }}
          >
            <option value="">Open a saved run</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.createdAt.slice(0, 19)} ·{" "}
                {r.messages.at(-1)?.content.slice(0, 50)} · {r.outcome}
              </option>
            ))}
          </select>
          <select
            aria-label="Compare with"
            className={control}
            disabled={busy}
            value={compareId}
            onChange={(e) => setCompareId(e.target.value)}
          >
            <option value="">Compare with another run</option>
            {runs
              .filter((r) => r.id !== run?.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.createdAt.slice(0, 19)} ·{" "}
                  {r.messages.at(-1)?.content.slice(0, 50)}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            Import run (JSON, up to 5 MB)
            <input
              aria-label="Import run"
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void perform(async () => {
                    if (file.size > 5 * 1024 * 1024)
                      throw new Error("Import exceeds 5 MB.");
                    const imported = runExportSchema.parse(
                      JSON.parse(await file.text()),
                    );
                    const value = { ...imported.run, id: crypto.randomUUID() };
                    await persist(value);
                    setRun(value);
                    setForkMessages(null);
                    setSettings(value.settings);
                  });
                e.target.value = "";
              }}
            />
          </label>
          <Button
            variant="outline"
            disabled={busy || !run}
            onClick={() =>
              void perform(async () => {
                if (
                  run &&
                  confirm("Export first if needed. Delete this local run?")
                ) {
                  await deleteRun(config.userId, run.id);
                  setRuns(await listRuns(config.userId));
                  setRun(null);
                }
              })
            }
          >
            Delete run
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                if (
                  confirm(
                    "Export first if needed. Delete all your local runs and presets?",
                  )
                ) {
                  await clearHistory(config.userId);
                  setRuns([]);
                  setPresets([]);
                  setRun(null);
                }
              })
            }
          >
            Clear my history
          </Button>
        </div>
        {run && comparison && (
          <div className="space-y-3" aria-label="Run comparison">
            {compareRuns(run, comparison).map((row) => (
              <details
                key={row.label}
                className={`rounded-lg border p-3 ${row.changed ? "border-amber-500/50 bg-amber-500/5" : "bg-muted/30"}`}
                open={row.label === "Final answer"}
              >
                <summary className="cursor-pointer text-sm font-medium">
                  {row.label}{" "}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {row.changed ? "Changed" : "Same"}
                  </span>
                </summary>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  {[row.left, row.right].map((value, i) => (
                    <div key={i} className="min-w-0">
                      <p className="mb-2 text-xs text-muted-foreground">
                        {i === 0 ? "Selected run" : "Compared run"}
                      </p>
                      <pre className="overflow-auto whitespace-pre-wrap break-all text-xs">
                        {value}
                      </pre>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
