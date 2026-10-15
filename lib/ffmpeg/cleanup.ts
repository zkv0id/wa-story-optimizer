import type { Engine } from "@/lib/ffmpeg/types";

/**
 * Best-effort removal of a file from the virtual filesystem. Errors are
 * swallowed because cleanup must never mask the original failure.
 */
export async function safeDeleteFile(engine: Engine, path: string): Promise<void> {
  try {
    await engine.deleteFile(path);
  } catch {
    // File may not exist; ignore.
  }
}

/** Revokes an object URL if present (safe to call with undefined). */
export function releaseObjectUrl(url?: string | null): void {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Already revoked or unsupported; ignore.
  }
}

export interface CleanupTargets {
  /** Virtual filesystem paths to delete. */
  paths?: string[];
  /** Object URLs to revoke. */
  urls?: Array<string | null | undefined>;
  /** When true, terminate the worker and drop the cached instance. */
  terminate?: boolean;
}

/**
 * Cleans up virtual files, object URLs and (optionally) the worker. No media
 * is ever persisted server-side, so this is the entire teardown surface.
 */
export async function cleanup(opts: {
  engine?: Engine | null;
  targets?: CleanupTargets;
  terminateEngine?: () => void;
}): Promise<void> {
  const { engine, targets, terminateEngine } = opts;

  if (engine && targets?.paths?.length) {
    await Promise.all(targets.paths.map((p) => safeDeleteFile(engine, p)));
  }

  for (const url of targets?.urls ?? []) {
    releaseObjectUrl(url);
  }

  if (targets?.terminate) {
    terminateEngine?.();
  }
}
