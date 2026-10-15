import { describe, expect, it } from "vitest";
import { parseProbeLogs } from "@/lib/ffmpeg/probe";

const LOGS = [
  "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'input.mp4':",
  "  Metadata:",
  "    major_brand     : isom",
  "  Duration: 00:00:12.34, start: 0.000000, bitrate: 8123 kb/s",
  "  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709), 1920x1080 [SAR 1:1 DAR 16:9], 7800 kb/s, 29.97 fps, 29.97 tbr, 15360 tbn",
  "  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s",
];

describe("parseProbeLogs", () => {
  it("parses container, duration and bitrate", () => {
    const meta = parseProbeLogs(LOGS)!;
    expect(meta.format).toBe("mov");
    expect(meta.duration).toBeCloseTo(12.34, 2);
    expect(meta.bitrate).toBe(8_123_000);
  });

  it("parses video and audio streams", () => {
    const meta = parseProbeLogs(LOGS)!;
    expect(meta.videoCodec).toBe("h264");
    expect(meta.audioCodec).toBe("aac");
    expect(meta.hasAudio).toBe(true);
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1080);
    expect(meta.fps).toBeCloseTo(29.97, 2);
  });

  it("returns null when there is no input header", () => {
    expect(parseProbeLogs(["nonsense", "no stream here"])).toBeNull();
  });

  it("swaps dimensions for 90/270 degree rotation", () => {
    const rotated = [
      "Input #0, mov,mp4,m4a, from 'p.mp4':",
      "  Duration: 00:00:05.00, start: 0.000000, bitrate: 4000 kb/s",
      "  Stream #0:0: Video: h264, yuv420p, 1920x1080, 30 fps, 30 tbr",
      "    displaymatrix: rotation of -90.00 degrees",
    ];
    const meta = parseProbeLogs(rotated)!;
    expect(meta.rotation).toBe(270);
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
  });

  it("reports no audio as hasAudio=false", () => {
    const silent = [
      "Input #0, mp4, from 's.mp4':",
      "  Duration: 00:00:03.00, start: 0.000000, bitrate: 1200 kb/s",
      "  Stream #0:0: Video: h264, yuv420p, 640x480, 25 fps, 25 tbr",
    ];
    const meta = parseProbeLogs(silent)!;
    expect(meta.hasAudio).toBe(false);
    expect(meta.audioCodec).toBeNull();
    expect(meta.width).toBe(640);
  });
});
