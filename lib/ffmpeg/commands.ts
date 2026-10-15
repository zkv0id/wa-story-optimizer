import type { EncodeProfile, MediaMetadata } from "@/types";

/**
 * Builds the video filtergraph.
 *
 * The scale expression uses `min(box, iw)` / `min(box, ih)` so the output is
 * only ever *downscaled*; smaller sources pass through unchanged. Commas
 * inside the expression are escaped because a comma separates filters in a
 * filtergraph. `force_original_aspect_ratio=decrease` preserves the aspect
 * ratio without distortion and `force_divisible_by=2` guarantees the even
 * dimensions H.264 requires (no cropping is performed).
 */
export function buildVideoFilter(
  profile: EncodeProfile,
  metadata: MediaMetadata,
  sharpen: boolean,
): string | null {
  const filters: string[] = [];

  const needsScale =
    metadata.width > 0 && metadata.height > 0 && Math.max(metadata.width, metadata.height) > profile.scaleBox;

  if (needsScale) {
    filters.push(
      `scale=w=min(${profile.scaleBox}\\,iw):h=min(${profile.scaleBox}\\,ih):` +
        `force_original_aspect_ratio=decrease:force_divisible_by=2`,
    );
  }

  if (profile.fpsCap != null && metadata.fps != null && metadata.fps > profile.fpsCap) {
    filters.push(`fps=${profile.fpsCap}`);
  }

  // Conservative sharpening: small amount, small radius. Optional and off by
  // default so it can never degrade detail unless the user opts in.
  if (sharpen) {
    filters.push("unsharp=5:5:0.5:5:5:0.0");
  }

  return filters.length > 0 ? filters.join(",") : null;
}

export interface BuildArgsOptions {
  /** Apply the optional conservative sharpening filter. */
  sharpen?: boolean;
}

/**
 * Assembles a structured FFmpeg argument array (no shell string, no
 * injection surface). Arguments are passed directly to FFmpeg.wasm's `exec`.
 */
export function buildFfmpegArgs(
  inputName: string,
  outputName: string,
  profile: EncodeProfile,
  metadata: MediaMetadata,
  options: BuildArgsOptions = {},
): string[] {
  const args: string[] = [
    "-hide_banner",
    "-y",
    "-i",
    inputName,
    "-map",
    "0:v:0",
  ];

  if (metadata.hasAudio) {
    args.push("-map", "0:a:0");
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    profile.x264Preset,
    "-crf",
    String(profile.crf),
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "high",
  );

  const filter = buildVideoFilter(profile, metadata, options.sharpen ?? profile.denoiseSharpen);
  if (filter) {
    args.push("-vf", filter);
  }

  args.push("-movflags", "+faststart");

  if (metadata.hasAudio) {
    args.push(
      "-c:a",
      "aac",
      "-b:a",
      `${profile.audioBitrateKbps}k`,
      "-ac",
      "2",
      "-ar",
      "44100",
    );
  } else {
    args.push("-an");
  }

  args.push(outputName);
  return args;
}

/** Arguments used to print stream information to the log (probe step). */
export function buildProbeArgs(inputName: string): string[] {
  return ["-hide_banner", "-i", inputName];
}

/** Human-readable summary of the planned output, for the UI. */
export function describePlan(profile: EncodeProfile, metadata: MediaMetadata): string {
  const parts: string[] = [`CRF ${profile.crf}`, profile.x264Preset];
  if (metadata.width && metadata.height && Math.max(metadata.width, metadata.height) > profile.scaleBox) {
    parts.push(`downscale to ${profile.scaleBox}px box`);
  } else {
    parts.push("keep source resolution");
  }
  parts.push(profile.fpsCap != null ? `cap ${profile.fpsCap} fps` : "keep source fps");
  parts.push(metadata.hasAudio ? `AAC ${profile.audioBitrateKbps}k` : "no audio");
  return parts.join(" · ");
}
