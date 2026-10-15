import type { MediaMetadata } from "@/types";
import { OptimizerError } from "@/lib/errors";

function normalizeRotation(deg: number): 0 | 90 | 180 | 270 {
  const mod = ((Math.round(deg) % 360) + 360) % 360;
  if (mod === 90 || mod === 180 || mod === 270) return mod;
  return 0;
}

function firstMatch(text: string, re: RegExp): RegExpMatchArray | null {
  return text.match(re);
}

/**
 * Parses FFmpeg's stderr/stdout probe output into {@link MediaMetadata}.
 *
 * Pure and side-effect free so it can be unit tested without a browser.
 * Width/height are returned as *display* dimensions: for 90/270 degree
 * rotation the stored frame is swapped, matching what FFmpeg's automatic
 * rotation produces during a transcode.
 */
export function parseProbeLogs(logs: string[]): MediaMetadata | null {
  const text = logs.join("\n");
  if (!/Input #0/i.test(text)) return null;

  const formatMatch = firstMatch(text, /Input #\d+,\s*(.+?),\s*from\s/i);
  const format = (formatMatch?.[1] ?? "").split(",")[0].trim();

  const durMatch = firstMatch(text, /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
  let duration = 0;
  if (durMatch) {
    duration = Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60 + Number(durMatch[3]);
  }

  const bitrateMatch = firstMatch(text, /bitrate:\s*(\d+)\s*kb\/s/i);
  const bitrate = bitrateMatch ? Number(bitrateMatch[1]) * 1000 : null;

  // Video stream: first Video: occurrence.
  const videoLine = logs.find((l) => /Stream #\d+:\d+.*Video:/.test(l)) ?? null;
  let videoCodec: string | null = null;
  let width = 0;
  let height = 0;
  let fps: number | null = null;

  if (videoLine) {
    videoCodec = firstMatch(videoLine, /Video:\s*([a-zA-Z0-9_]+)/i)?.[1] ?? null;
    const dims = firstMatch(videoLine, /(?:^|[,\s])(\d{2,5})x(\d{2,5})(?:[,\s\[]|$)/);
    if (dims) {
      width = Number(dims[1]);
      height = Number(dims[2]);
    }
    const fpsMatch = firstMatch(videoLine, /(\d+(?:\.\d+)?)\s*fps/i);
    if (fpsMatch) fps = Number(fpsMatch[1]);
  }

  const audioLine = logs.find((l) => /Stream #\d+:\d+.*Audio:/.test(l)) ?? null;
  const audioCodec = audioLine
    ? firstMatch(audioLine, /Audio:\s*([a-zA-Z0-9_]+)/i)?.[1] ?? null
    : null;

  // Rotation can appear as displaymatrix side data or a legacy "rotate" tag.
  let rotation = 0;
  const rotMatch = firstMatch(text, /rotation of\s*(-?\d+(?:\.\d+)?)\s*degrees/i);
  if (rotMatch) {
    rotation = normalizeRotation(Number(rotMatch[1]));
  } else {
    const tagMatch = firstMatch(text, /rotate\s*:\s*(-?\d+)/i);
    if (tagMatch) rotation = normalizeRotation(Number(tagMatch[1]));
  }

  // Swap to display dimensions for quarter turns.
  if (rotation === 90 || rotation === 270) {
    [width, height] = [height, width];
  }

  return {
    format,
    videoCodec,
    audioCodec,
    duration,
    width,
    height,
    fps,
    bitrate,
    hasAudio: audioCodec != null,
    rotation,
  };
}

/** Minimal structural type of the FFmpeg instance we depend on. */
export interface ProbeCapableFfmpeg {
  exec(args: string[]): Promise<number>;
  on(event: "log", cb: (e: { type: string; message: string }) => void): void;
  off(event: "log", cb: (e: { type: string; message: string }) => void): void;
}

/**
 * Runs FFmpeg with only an input to collect stream info from the log.
 * FFmpeg exits non-zero because no output is given, which is expected.
 */
export async function probeFile(
  ffmpeg: ProbeCapableFfmpeg,
  inputName: string,
  fileSize: number,
): Promise<MediaMetadata> {
  const collected: string[] = [];
  const handler = (event: { type: string; message: string }) => {
    collected.push(event.message);
  };

  ffmpeg.on("log", handler);
  try {
    await ffmpeg.exec(["-hide_banner", "-i", inputName]);
  } catch {
    // Ignore: exec rejects/errors because no output target was provided.
  } finally {
    ffmpeg.off("log", handler);
  }

  const meta = parseProbeLogs(collected);
  if (!meta) {
    throw new OptimizerError("PROBE_FAILED", collected.slice(-12).join("\n"));
  }
  if (!meta.videoCodec) {
    throw new OptimizerError("NO_VIDEO_STREAM", collected.slice(-12).join("\n"));
  }
  if (fileSize > 0 && meta.duration === 0) {
    throw new OptimizerError("CORRUPT_FILE", "Missing duration metadata.");
  }
  return meta;
}
