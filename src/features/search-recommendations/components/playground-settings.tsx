"use client";
import {
  names,
  type ModelProfile,
  type PlaygroundSettings,
} from "../schemas/playground";
import { Input } from "@/shared/components/ui/input";
const control = "w-full rounded-md border bg-background p-2 text-sm";
export function PlaygroundSettingsPanel({
  settings,
  profiles,
  onChange,
  disabled,
}: {
  settings: PlaygroundSettings;
  profiles: ModelProfile[];
  onChange: (value: PlaygroundSettings) => void;
  disabled: boolean;
}) {
  const profile = profiles.find((p) => p.id === settings.modelId);
  const patch = (value: Partial<PlaygroundSettings>) =>
    onChange({ ...settings, ...value });
  return (
    <fieldset disabled={disabled} className="space-y-5 disabled:opacity-60">
      <label className="block space-y-1">
        Model
        <select
          aria-label="Model"
          className={control}
          value={settings.modelId}
          onChange={(e) => {
            const p = profiles.find((p) => p.id === e.target.value)!;
            patch({
              modelId: p.id,
              temperature: undefined,
              topP: undefined,
              toolChoice: "auto",
              maxOutputTokens: Math.min(
                settings.maxOutputTokens,
                p.maxOutputTokens,
              ),
            });
          }}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        Experiment instructions
        <textarea
          aria-label="Experiment instructions"
          className={control}
          rows={4}
          maxLength={8000}
          value={settings.instructions}
          onChange={(e) => patch({ instructions: e.target.value })}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Fixed safeguards remain active. Tool output is data; prices are EUR
        cents; purchase evidence is synthetic.
      </p>
      <label className="block space-y-1">
        Sampling
        <select
          aria-label="Sampling"
          className={control}
          value={
            settings.temperature !== undefined
              ? "temperature"
              : settings.topP !== undefined
                ? "topP"
                : "default"
          }
          onChange={(e) =>
            patch({
              temperature: e.target.value === "temperature" ? 0.7 : undefined,
              topP: e.target.value === "topP" ? 0.9 : undefined,
            })
          }
        >
          <option value="default">Provider default</option>
          <option value="temperature" disabled={!profile?.temperature}>
            Temperature{!profile?.temperature ? " — unsupported" : ""}
          </option>
          <option value="topP" disabled={!profile?.topP}>
            Top-p{!profile?.topP ? " — unsupported" : ""}
          </option>
        </select>
      </label>
      {settings.temperature !== undefined && (
        <label className="block">
          Temperature
          <Input
            aria-label="Temperature"
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={settings.temperature}
            onChange={(e) => patch({ temperature: Number(e.target.value) })}
          />
        </label>
      )}
      {settings.topP !== undefined && (
        <label className="block">
          Top-p
          <Input
            aria-label="Top-p"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={settings.topP}
            onChange={(e) => patch({ topP: Number(e.target.value) })}
          />
        </label>
      )}
      <label className="block">
        Output tokens
        <Input
          aria-label="Output tokens"
          type="number"
          min={1}
          max={profile?.maxOutputTokens ?? 4096}
          value={settings.maxOutputTokens}
          onChange={(e) => patch({ maxOutputTokens: Number(e.target.value) })}
        />
      </label>
      <label className="block">
        Agent steps
        <Input
          aria-label="Agent steps"
          type="number"
          min={1}
          max={10}
          value={settings.maxSteps}
          onChange={(e) => patch({ maxSteps: Number(e.target.value) })}
        />
      </label>
      <div className="space-y-2">
        <p className="font-medium">Enabled tools</p>
        {names.map((name) => (
          <label key={name} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.enabledTools.includes(name)}
              onChange={(e) => {
                const enabledTools = e.target.checked
                  ? [...settings.enabledTools, name]
                  : settings.enabledTools.filter((n) => n !== name);
                const descriptionOverrides = {
                  ...settings.descriptionOverrides,
                };
                if (!e.target.checked) delete descriptionOverrides[name];
                patch({
                  enabledTools,
                  descriptionOverrides,
                  toolChoice: "auto",
                });
              }}
            />
            {name}
          </label>
        ))}
      </div>
      <label className="block">
        Tool selection
        <select
          aria-label="Tool selection"
          className={control}
          disabled={!profile?.toolChoice}
          value={settings.toolChoice}
          onChange={(e) =>
            patch({
              toolChoice: e.target.value as PlaygroundSettings["toolChoice"],
            })
          }
        >
          <option value="auto">Auto</option>
          <option value="required" disabled={!settings.enabledTools.length}>
            Required
          </option>
          {settings.enabledTools.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      {!profile?.toolChoice && (
        <p className="text-xs text-muted-foreground">
          This model profile supports automatic selection only.
        </p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.includeOpenApi}
          onChange={(e) => patch({ includeOpenApi: e.target.checked })}
        />
        Include OpenAPI resource in context
      </label>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Advanced: tool descriptions
        </summary>
        <p className="my-2 text-xs text-muted-foreground">
          Overrides apply to this experiment, not the published MCP server.
        </p>
        {settings.enabledTools.map((name) => (
          <label key={name} className="mb-3 block text-sm">
            {name}
            <textarea
              aria-label={`${name} description override`}
              className={control}
              maxLength={4000}
              rows={3}
              placeholder="Use published description"
              value={settings.descriptionOverrides[name] ?? ""}
              onChange={(e) => {
                const descriptionOverrides = {
                  ...settings.descriptionOverrides,
                };
                if (e.target.value) descriptionOverrides[name] = e.target.value;
                else delete descriptionOverrides[name];
                patch({ descriptionOverrides });
              }}
            />
          </label>
        ))}
      </details>
    </fieldset>
  );
}
