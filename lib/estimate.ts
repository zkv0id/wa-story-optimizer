import type { EncodeProfile, MediaMetadata } from "@/types";

/**
 * Rough output-size estimate. This is a heuristic (bits-per-pixel-per-frame
 * tuned per CRF), NOT a benchmark result. It is intentionally conservative
 * and only meant to set expectations before encoding.
 */
export function estimateOutputBytes(profile: EncodeProfile, metadata: MediaMetadata): number | null {
  if (!metadata.width || !metadata.height || !metadata.duration) return null;

  const longSide = Math.max(metadata.width, metadata.height);
  const shortSide = Math.min(metadata.width, metadata.height);
  const scale = longSide > profile.scaleBox ? profile.scaleBox / longSide : 1;
  const outLong = Math.round(longSide * scale);
  const outShort = Math.round(shortSide * scale);

  const fps = profile.fpsCap != null ? Math.min(profile.fpsCap, metadata.fps ?? profile.fpsCap) : metadata.fps ?? 30;

  // Bits per pixel per frame, calibrated loosely against CRF.
  const bpp = profile.crf <= 18 ? 0.1 : profile.crf <= 23 ? 0.065 : 0.04;
  const videoBps = outLong * outShort * fps * bpp;
  const audioBps = metadata.hasAudio ? profile.audioBitrateKbps * 1000 : 0;

  const bytes = ((videoBps + audioBps) * metadata.duration) / 8;
  return Math.max(0, Math.round(bytes));
}
