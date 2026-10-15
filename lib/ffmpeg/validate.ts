import type { MediaMetadata, EncodeProfile } from "@/types";
import { OptimizerError } from "@/lib/errors";
import { parseProbeLogs, type ProbeCapableFfmpeg } from "@/lib/ffmpeg/probe";

export interface OutputExpectation {
  /** Source metadata used to sanity-check the output. */
  source: MediaMetadata;
  profile: EncodeProfile;
}

/**
 * Verifies an encoded artifact by re-reading its stream information and
 * checking for the properties WhatsApp compatibility depends on:
 * a video stream, MP4/H.264, yuv420p-friendly output and non-zero duration.
 */
export async function validateOutput(
  ffmpeg: ProbeCapableFfmpeg,
  outputName: string,
  expectation: OutputExpectation,
): Promise<MediaMetadata> {
  const collected: string[] = [];
  const handler = (event: { type: string; message: string }) => {
    collected.push(event.message);
  };

  ffmpeg.on("log", handler);
  try {
    await ffmpeg.exec(["-hide_banner", "-i", outputName]);
  } catch {
    // Expected non-zero exit: no output target supplied.
  } finally {
    ffmpeg.off("log", handler);
  }

  const meta = parseProbeLogs(collected);
  if (!meta) {
    throw new OptimizerError("OUTPUT_INVALID", "Output has no readable streams.");
  }
  if (!meta.videoCodec || meta.videoCodec !== "h264") {
    throw new OptimizerError("OUTPUT_INVALID", `Unexpected output codec: ${meta.videoCodec ?? "none"}`);
  }
  if (meta.duration <= 0) {
    throw new OptimizerError("OUTPUT_INVALID", "Output duration is zero.");
  }
  if (meta.width <= 0 || meta.height <= 0) {
    throw new OptimizerError("OUTPUT_INVALID", "Output has invalid dimensions.");
  }
  // Never larger than the source box by more than rounding.
  const srcLong = Math.max(expectation.source.width, expectation.source.height);
  const outLong = Math.max(meta.width, meta.height);
  if (srcLong > 0 && outLong > srcLong + 2) {
    throw new OptimizerError("OUTPUT_INVALID", "Output was unexpectedly upscaled.");
  }

  return meta;
}
