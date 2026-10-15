import { describe, expect, it } from "vitest";
import { buildFfmpegArgs, buildVideoFilter, describePlan } from "@/lib/ffmpeg/commands";
import { selectProfile } from "@/lib/ffmpeg/profiles";
import type { MediaMetadata } from "@/types";

function meta(overrides: Partial<MediaMetadata> = {}): MediaMetadata {
  return {
    format: "mov,mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    duration: 12,
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate: 6_000_000,
    hasAudio: true,
    rotation: 0,
    ...overrides,
  };
}

describe("buildVideoFilter", () => {
  it("returns null when no scaling, fps change or sharpen is needed", () => {
    const profile = selectProfile("maximum", meta({ width: 1280, height: 720 }));
    expect(buildVideoFilter(profile, meta({ width: 1280, height: 720 }), false)).toBeNull();
  });

  it("escapes commas in the scale expression and uses downscale-only min()", () => {
    const m = meta();
    const profile = selectProfile("balanced", m);
    const filter = buildVideoFilter(profile, m, false);
    expect(filter).toContain("min(1080\\,iw)");
    expect(filter).toContain("force_original_aspect_ratio=decrease");
    expect(filter).toContain("force_divisible_by=2");
  });

  it("adds an fps filter only when the source exceeds the cap", () => {
    const high = meta({ fps: 60 });
    expect(buildVideoFilter(selectProfile("small", high), high, false)).toContain("fps=30");
    const low = meta({ fps: 24 });
    expect(buildVideoFilter(selectProfile("small", low), low, false)).not.toContain("fps=");
  });

  it("adds a conservative unsharp mask only when requested", () => {
    const m = meta({ width: 640, height: 480 });
    const profile = selectProfile("balanced", m);
    expect(buildVideoFilter(profile, m, true)).toBe("unsharp=5:5:0.5:5:5:0.0");
  });
});

describe("buildFfmpegArgs", () => {
  const m = meta();
  const profile = selectProfile("balanced", m);
  const args = buildFfmpegArgs("in.mp4", "out.mp4", profile, m);

  it("uses structured arguments with an explicit output as the last element", () => {
    expect(args[args.length - 1]).toBe("out.mp4");
    expect(args[0]).toBe("-hide_banner");
  });

  it("configures H.264 with CRF, pixel format, profile and faststart", () => {
    expect(args).toContain("libx264");
    expect(args[args.indexOf("-crf") + 1]).toBe(String(profile.crf));
    expect(args[args.indexOf("-pix_fmt") + 1]).toBe("yuv420p");
    expect(args[args.indexOf("-movflags") + 1]).toBe("+faststart");
    expect(args).toContain("-preset");
  });

  it("maps audio and adds AAC settings when audio exists", () => {
    expect(args).toContain("-c:a");
    expect(args[args.indexOf("-c:a") + 1]).toBe("aac");
    expect(args).toContain(`${profile.audioBitrateKbps}k`);
    expect(args).not.toContain("-an");
  });

  it("disables audio with -an when the source has none", () => {
    const silent = buildFfmpegArgs("in.mp4", "out.mp4", profile, meta({ hasAudio: false, audioCodec: null }));
    expect(silent).toContain("-an");
    expect(silent).not.toContain("-c:a");
  });

  it("never contains shell metacharacters from file names", () => {
    const evil = buildFfmpegArgs("a;rm -rf /.mp4", "b$(whoami).mp4", profile, m);
    // Arguments are discrete array elements; the dangerous name stays isolated.
    expect(evil).toContain("a;rm -rf /.mp4");
    expect(evil.filter((a) => a === "-crf")).toHaveLength(1);
  });

  it("describes the plan for the UI", () => {
    expect(describePlan(profile, m)).toContain("CRF");
    expect(describePlan(profile, m)).toContain("AAC");
  });
});
