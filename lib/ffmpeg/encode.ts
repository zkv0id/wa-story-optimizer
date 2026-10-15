import type { EncodeResult, EncodeProfile, MediaMetadata, PresetId } from "@/types";
import { OptimizerError } from "@/lib/errors";
import { buildFfmpegArgs } from "@/lib/ffmpeg/commands";
import { selectProfile } from "@/lib/ffmpeg/profiles";
import { validateOutput } from "@/lib/ffmpeg/validate";
import type { Engine, FileData } from "@/lib/ffmpeg/types";

export interface EncodeInput {
  engine: Engine;
  file: File;
  metadata: MediaMetadata;
  preset: PresetId;
  /** Optional job id used to build unique virtual filesystem names. */
  jobId?: string;
  /** Explicit virtual input path (defaults to a generated name). */
  inputName?: string;
  /** When true, the caller has already written the input file. */
  skipWrite?: boolean;
  /** Optional conservative sharpening toggle. */
  sharpen?: boolean;
  /** Called with progress in 0..1 (or null) and elapsed milliseconds. */
  onProgress?: (ratio: number | null, elapsedMs: number) => void;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "bin";
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Writes the source into the virtual filesystem, encodes it with the resolved
 * profile, verifies the output and returns a Blob. The virtual input/output
 * files are left in place for the cleanup stage; the caller owns teardown.
 */
export async function encodeMedia(input: EncodeInput): Promise<EncodeResult> {
  const { engine, file, metadata, preset, onProgress, sharpen } = input;
  const jobId = input.jobId ?? makeId();
  const inputName = input.inputName ?? `input_${jobId}.${extensionOf(file.name)}`;
  const outputName = `output_${jobId}.mp4`;

  const profile: EncodeProfile = selectProfile(preset, metadata);
  const args = buildFfmpegArgs(inputName, outputName, profile, metadata, { sharpen });

  const startedAt = Date.now();
  let lastEmit = 0;

  const progressHandler = (event: { progress: number; time: number }) => {
    if (!onProgress) return;
    const now = Date.now();
    // Throttle UI updates to ~4/s to avoid re-render churn on mobile.
    if (now - lastEmit < 250 && event.progress < 1) return;
    lastEmit = now;
    const fromTime = metadata.duration > 0 ? event.time / 1_000_000 / metadata.duration : NaN;
    const ratio = Number.isFinite(fromTime) ? clamp01(fromTime) : clamp01(event.progress);
    onProgress(ratio, now - startedAt);
  };

  engine.on("progress", progressHandler);

  let writeOk = true;
  try {
    if (!input.skipWrite) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      writeOk = await engine.writeFile(inputName, bytes);
      if (!writeOk) {
        throw new OptimizerError("MEMORY", "Could not allocate a buffer in the virtual filesystem.");
      }
    }

    const exitCode = await engine.exec(args);
    if (exitCode !== 0) {
      throw new OptimizerError("ENCODE_FAILED", `FFmpeg exited with code ${exitCode}.`);
    }

    const outMeta = await validateOutput(engine, outputName, { source: metadata, profile });

    const data: FileData = await engine.readFile(outputName);
    const bytesOut = typeof data === "string" ? new TextEncoder().encode(data) : data;
    if (!bytesOut || bytesOut.byteLength === 0) {
      throw new OptimizerError("OUTPUT_INVALID", "Encoded file is empty.");
    }

    const blob = new Blob([bytesOut], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const elapsedMs = Date.now() - startedAt;

    return {
      outputName,
      blob,
      url,
      size: blob.size,
      metadata: outMeta,
      elapsedMs,
      profile,
    };
  } catch (error) {
    if (error instanceof OptimizerError) throw error;
    throw new OptimizerError(
      "ENCODE_FAILED",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    engine.off("progress", progressHandler);
  }
}
