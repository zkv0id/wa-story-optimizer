import { describe, expect, it } from "vitest";
import { PROFILES, PRESET_ORDER, isPresetId, selectProfile } from "@/lib/ffmpeg/profiles";
import type { MediaMetadata } from "@/types";

function meta(overrides: Partial<MediaMetadata> = {}): MediaMetadata {
  return {
    format: "mov,mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    duration: 10,
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate: 8_000_000,
    hasAudio: true,
    rotation: 0,
    ...overrides,
  };
}

describe("profiles", () => {
  it("exposes the three expected presets", () => {
    expect(PRESET_ORDER).toEqual(["balanced", "maximum", "small"]);
    for (const id of PRESET_ORDER) expect(PROFILES[id]).toBeDefined();
  });

  it("validates preset ids", () => {
    expect(isPresetId("balanced")).toBe(true);
    expect(isPresetId("nope")).toBe(false);
    expect(isPresetId(42)).toBe(false);
  });

  it("never upscales a small source (scaleBox clamps to source)", () => {
    const profile = selectProfile("maximum", meta({ width: 640, height: 480 }));
    expect(profile.scaleBox).toBe(640);
  });

  it("keeps the profile box for larger sources", () => {
    expect(selectProfile("balanced", meta()).scaleBox).toBe(1080);
    expect(selectProfile("small", meta()).scaleBox).toBe(720);
  });

  it("preserves source fps for balanced and maximum", () => {
    expect(selectProfile("balanced", meta({ fps: 60 })).fpsCap).toBeNull();
    expect(selectProfile("maximum", meta({ fps: 60 })).fpsCap).toBeNull();
  });

  it("caps fps only for small when the source exceeds the cap", () => {
    expect(selectProfile("small", meta({ fps: 60 })).fpsCap).toBe(30);
    expect(selectProfile("small", meta({ fps: 24 })).fpsCap).toBeNull();
  });

  it("uses descending CRF from maximum to small", () => {
    expect(PROFILES.maximum.crf).toBeLessThan(PROFILES.balanced.crf);
    expect(PROFILES.balanced.crf).toBeLessThan(PROFILES.small.crf);
  });

  it("throws on unknown presets", () => {
    expect(() => selectProfile("bogus" as never, meta())).toThrow();
  });
});
