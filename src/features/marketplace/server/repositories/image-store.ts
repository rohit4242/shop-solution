import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { IMAGE_KEY } from "../../schemas/marketplace.schema";

// Where listing image bytes live. `OfferImage` keeps only the storage key and
// metadata (docs/commerce/README.md: "move image bytes to the approved storage
// adapter"). The class has not picked object storage yet, so this is a local
// disk adapter for development. Swap the implementation, not the callers.

export type ImageMeta = { mediaType: string; byteSize: number };
export type StoredImage = ImageMeta & { bytes: Uint8Array };

export interface ImageStore {
  put(key: string, bytes: Uint8Array, meta: ImageMeta): Promise<void>;
  head(key: string): Promise<ImageMeta | null>;
  get(key: string): Promise<StoredImage | null>;
}

const isMissing = (error: unknown) =>
  (error as NodeJS.ErrnoException)?.code === "ENOENT";

/** Files `<dir>/<key>` and `<dir>/<key>.json`. Keys are validated, never paths. */
export function localImageStore(dir: string): ImageStore {
  const file = (key: string) => {
    if (!IMAGE_KEY.test(key)) throw new Error("Invalid image key.");
    return path.join(dir, key);
  };
  const head = async (key: string): Promise<ImageMeta | null> => {
    try {
      const meta = JSON.parse(await readFile(file(key) + ".json", "utf8"));
      return {
        mediaType: String(meta.mediaType),
        byteSize: Number(meta.byteSize),
      };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  };
  return {
    async put(key, bytes, meta) {
      await mkdir(dir, { recursive: true });
      await writeFile(file(key), bytes, { flag: "wx" });
      await writeFile(file(key) + ".json", JSON.stringify(meta), {
        flag: "wx",
      });
    },
    head,
    async get(key) {
      const meta = await head(key);
      if (!meta) return null;
      try {
        return { ...meta, bytes: new Uint8Array(await readFile(file(key))) };
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
  };
}

let store: ImageStore | null = null;

/** The configured store: MARKETPLACE_IMAGE_DIR, default `.data/marketplace-images`. */
export function imageStore(): ImageStore {
  store ??= localImageStore(
    process.env.MARKETPLACE_IMAGE_DIR?.trim() ||
      path.join(process.cwd(), ".data", "marketplace-images"),
  );
  return store;
}
