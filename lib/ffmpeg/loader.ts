import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { OptimizerError } from "@/lib/errors";

/**
 * Self-hosted (same-origin) FFmpeg core assets copied by
 * `scripts/copy-ffmpeg-core.mjs`. Using the single-threaded core avoids the
 * SharedArrayBuffer / cross-origin-isolation requirement, which keeps the app
 * deployable on Vercel without custom COOP/COEP headers and working on
 * standard Android browsers.
 */
export const CORE_BASE_PATH = "/ffmpeg";

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export type EngineStatus = "idle" | "loading" | "ready" | "error";

/** Lightweight capability check for the in-browser engine. */
export function isBrowserSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof WebAssembly !== "object") return false;
  try {
    return typeof Worker !== "undefined";
  } catch {
    return false;
  }
}

export function getLoadedFFmpeg(): FFmpeg | null {
  return instance;
}

/**
 * Lazily loads and caches the FFmpeg worker. Concurrent callers share the
 * same promise so the 30 MB WASM core is fetched only once.
 */
export async function loadFFmpeg(onStatus?: (status: EngineStatus, message?: string) => void): Promise<FFmpeg> {
  if (instance) return instance;
  if (loadPromise) return loadPromise;

  if (!isBrowserSupported()) {
    throw new OptimizerError("BROWSER_UNSUPPORTED");
  }

  onStatus?.("loading");
  loadPromise = (async () => {
    const ff = new FFmpeg();
    try {
      const coreURL = await toBlobURL(`${CORE_BASE_PATH}/ffmpeg-core.js`, "text/javascript");
      const wasmURL = await toBlobURL(`${CORE_BASE_PATH}/ffmpeg-core.wasm`, "application/wasm");
      await ff.load({ coreURL, wasmURL });
    } catch (error) {
      loadPromise = null;
      throw new OptimizerError("ENGINE_LOAD_FAILED", error instanceof Error ? error.message : String(error));
    }
    instance = ff;
    onStatus?.("ready");
    return ff;
  })();

  return loadPromise;
}

/** Tears down the worker and allows a subsequent lazy reload. */
export function terminateFFmpeg(): void {
  if (instance) {
    try {
      instance.terminate();
    } catch {
      // Worker already gone; nothing to do.
    }
  }
  instance = null;
  loadPromise = null;
}
