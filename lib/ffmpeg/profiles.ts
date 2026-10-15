import type { EncodeProfile, MediaMetadata, PresetId } from "@/types";

/**
 * Central, measurable encoding profiles.
 *
 * Rationale for the numbers (no preset is claimed to be objectively "best";
 * see README for the A/B testing guide):
 *
 * - `crf` is the primary quality lever for libx264. Lower is better quality
 *   and larger. 18 is near-visually-lossless, 23 is the x264 default, 28 is
 *   a clear size trade-off.
 * - `x264Preset` trades encode time for compression efficiency. In
 *   FFmpeg.wasm CPU is scarce, so we bias toward faster presets than a native
 *   desktop build would use.
 * - `scaleBox` is a *downscale-only* bounding box; sources smaller than the
 *   box are left untouched (never upscaled).
 * - `fpsCap` is `null` for Balanced/Maximum to preserve the source frame rate.
 *   Small File caps at 30 fps, a deliberate motion/size trade-off.
 * - `audioBitrateKbps` uses AAC, which is universally decodable by
 *   Android/iOS WhatsApp clients.
 */
export const PROFILES: Record<PresetId, Omit<EncodeProfile, "id">> = {
  maximum: {
    label: "Maximum Quality",
    description: "Highest fidelity. Largest files and slowest encoding.",
    crf: 18,
    x264Preset: "faster",
    scaleBox: 1920,
    fpsCap: null,
    audioBitrateKbps: 192,
    denoiseSharpen: false,
  },
  balanced: {
    label: "Balanced",
    description: "Good quality with sensible size and processing time.",
    crf: 23,
    x264Preset: "veryfast",
    scaleBox: 1080,
    fpsCap: null,
    audioBitrateKbps: 128,
    denoiseSharpen: false,
  },
  small: {
    label: "Small File",
    description: "Smallest files. Visible quality trade-off, best for slow networks.",
    crf: 28,
    x264Preset: "veryfast",
    scaleBox: 720,
    fpsCap: 30,
    audioBitrateKbps: 96,
    denoiseSharpen: false,
  },
};

export const PRESET_ORDER: PresetId[] = ["balanced", "maximum", "small"];

export function isPresetId(value: unknown): value is PresetId {
  return typeof value === "string" && value in PROFILES;
}

/**
 * Resolves the effective profile for a source, applying "never upscale" and
 * "keep source fps unless the profile explicitly caps it" rules.
 */
export function selectProfile(preset: PresetId, metadata: MediaMetadata): EncodeProfile {
  if (!isPresetId(preset)) {
    throw new Error(`Unknown preset: ${String(preset)}`);
  }
  const base = PROFILES[preset];

  // Downscale-only box: never exceed the source's largest dimension and never
  // exceed the profile box. If the source is smaller it is preserved as-is.
  const sourceLongSide = Math.max(metadata.width || 0, metadata.height || 0);
  const scaleBox =
    sourceLongSide > 0 ? Math.min(base.scaleBox, sourceLongSide) : base.scaleBox;

  // Preserve source fps unless the profile caps it, and never raise fps.
  const fpsCap =
    base.fpsCap != null && metadata.fps != null && metadata.fps <= base.fpsCap
      ? null
      : base.fpsCap;

  return {
    id: preset,
    ...base,
    scaleBox,
    fpsCap,
  };
}
