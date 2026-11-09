import {
  runSchema,
  presetSchema,
  type SavedRun,
  type Preset,
} from "../schemas/playground";
type History = { runs: SavedRun[]; presets: Preset[] };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("shop-search-playground", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("users");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function access<T>(
  userId: string,
  mutate: ((state: History) => T) | null,
  read: (state: History) => T,
): Promise<T> {
  if (!userId) throw new Error("A user is required.");
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("users", mutate ? "readwrite" : "readonly"),
      store = tx.objectStore("users"),
      request = store.get(userId);
    let result: T;
    request.onsuccess = () => {
      try {
        const state: History = request.result ?? { runs: [], presets: [] };
        result = mutate ? mutate(state) : read(state);
        if (mutate) {
          if (
            state.runs.length > 50 ||
            state.presets.length > 20 ||
            new TextEncoder().encode(JSON.stringify(state)).length >
              20 * 1024 * 1024
          )
            throw new Error(
              "Storage limit reached. Export and explicitly delete older runs or presets before saving.",
            );
          store.put(state, userId);
        }
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("History transaction aborted."));
    };
  });
}
export const listRuns = (id: string) =>
  access(id, null, (s) =>
    [...s.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
export const listPresets = (id: string) => access(id, null, (s) => s.presets);
export async function saveRun(id: string, run: SavedRun) {
  const valid = runSchema.parse(run);
  await access(
    id,
    (s) => {
      s.runs = s.runs.filter((r) => r.id !== valid.id);
      s.runs.push(valid);
    },
    () => {},
  );
}
export async function deleteRun(id: string, runId: string) {
  await access(
    id,
    (s) => {
      s.runs = s.runs.filter((r) => r.id !== runId);
    },
    () => {},
  );
}
export async function savePreset(id: string, preset: Preset) {
  const valid = presetSchema.parse(preset);
  await access(
    id,
    (s) => {
      s.presets = s.presets.filter((p) => p.id !== valid.id);
      s.presets.push(valid);
    },
    () => {},
  );
}
export async function deletePreset(id: string, presetId: string) {
  await access(
    id,
    (s) => {
      s.presets = s.presets.filter((p) => p.id !== presetId);
    },
    () => {},
  );
}
export async function clearHistory(id: string) {
  await access(
    id,
    (s) => {
      s.runs = [];
      s.presets = [];
    },
    () => {},
  );
}
