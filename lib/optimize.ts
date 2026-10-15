import { validateDuration, validateInputFile } from "@/lib/validation";
import { isCancelled, OptimizerError, toOptimizerError } from "@/lib/errors";
import { LIMITS } from "@/lib/config";
import {
  cleanup,
  encodeMedia,
  getLoadedFFmpeg,
  loadFFmpeg,
  probeFile,
  selectProfile,
  terminateFFmpeg,
  type Engine,
} from "@/lib/ffmpeg";
import type { EncodeProfile, EncodeResult, JobPhase, MediaMetadata, PresetId } from "@/types";

export interface OptimizeOptions {
  file: File;
  preset: PresetId;
  /** Optional conservative sharpening (default off). */
  sharpen?: boolean;
  /** Cancel token: aborting terminates the worker and rejects the job. */
  signal?: AbortSignal;
  onPhase?: (phase: JobPhase, message: string) => void;
  onProgress?: (ratio: number | null, elapsedMs: number) => void;
  onMetadata?: (metadata: MediaMetadata, profile: EncodeProfile) => void;
}

function makeJobId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new OptimizerError("CANCELLED");
}

/**
 * End-to-end workflow: validate → lazy-load engine → probe → plan → encode →
 * verify → cleanup. Returns the encoded blob plus metadata. On any failure the
 * virtual files and (on cancel) the worker are released. The caller owns the
 * returned object URL and must revoke it via {@link releaseObjectUrl}.
 */
export async function optimizeVideo(options: OptimizeOptions): Promise<EncodeResult> {
  const { file, preset, sharpen = false, signal, onPhase, onProgress, onMetadata } = options;

  const jobId = makeJobId();
  let engine: Engine | null = null;
  let inputName: string | null = null;
  let outputName: string | null = null;
  const urls: string[] = [];

  const abortHandler = () => terminateFFmpeg();
  signal?.addEventListener("abort", abortHandler);

  try {
    onPhase?.("validating", "Validating file…");
    const validation = validateInputFile({ name: file.name, size: file.size, type: file.type });
    if (!validation.ok) {
      throw new OptimizerError(validation.code ?? "UNKNOWN", validation.message);
    }
    assertNotAborted(signal);

    onPhase?.("loading-engine", "Loading video engine…");
    const ffmpeg = await loadFFmpeg();
    engine = ffmpeg;
    assertNotAborted(signal);

    // Write the source once; probe and encode reuse the same virtual file.
    onPhase?.("probing", "Reading media information…");
    inputName = `input_${jobId}.${(file.name.split(".").pop() ?? "bin").toLowerCase()}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const writeOk = await ffmpeg.writeFile(inputName, bytes);
    if (!writeOk) throw new OptimizerError("MEMORY", "Virtual filesystem write failed.");
    assertNotAborted(signal);

    const metadata = await probeFile(ffmpeg, inputName, file.size);

    const durationCheck = validateDuration(metadata.duration);
    if (!durationCheck.ok) {
      throw new OptimizerError(durationCheck.code ?? "UNKNOWN", durationCheck.message);
    }

    onPhase?.("planning", "Selecting encoding profile…");
    const profile = selectProfile(preset, metadata);
    onMetadata?.(metadata, profile);
    assertNotAborted(signal);

    onPhase?.("encoding", "Encoding video…");
    const result = await encodeMedia({
      engine: ffmpeg,
      file,
      metadata,
      preset,
      jobId,
      inputName,
      skipWrite: true,
      sharpen,
      onProgress,
    });
    outputName = result.outputName;
    urls.push(result.url);
    assertNotAborted(signal);

    onPhase?.("validating-output", "Verifying output…");
    onPhase?.("done", "Completed");

    return result;
  } catch (error) {
    const normalized = toOptimizerError(error);
    if (isCancelled(normalized)) {
      onPhase?.("cancelled", normalized.message);
    } else {
      onPhase?.("error", normalized.message);
    }
    throw normalized;
  } finally {
    signal?.removeEventListener("abort", abortHandler);

    // Release virtual files and the worker to free mobile RAM. On success the
    // returned object URL is intentionally preserved for download/share; on
    // cancellation/failure any created URLs are revoked.
    const loaded = engine ?? getLoadedFFmpeg();
    const cancelledOrFailed = signal?.aborted ?? false;

    await cleanup({
      engine: loaded,
      targets: {
        paths: [inputName, outputName].filter((p): p is string => Boolean(p)),
        urls: cancelledOrFailed ? urls : [],
        terminate: true,
      },
      terminateEngine: terminateFFmpeg,
    });
  }
}

export { LIMITS };
