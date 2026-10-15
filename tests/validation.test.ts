import { describe, expect, it } from "vitest";
import { validateDuration, validateInputFile } from "@/lib/validation";
import { LIMITS } from "@/lib/config";

describe("validateInputFile", () => {
  it("accepts a supported mp4 file", () => {
    expect(validateInputFile({ name: "clip.mp4", size: 1024, type: "video/mp4" }).ok).toBe(true);
  });

  it("accepts by extension when MIME is empty", () => {
    expect(validateInputFile({ name: "clip.mov", size: 2048, type: "" }).ok).toBe(true);
  });

  it("rejects unsupported types", () => {
    const result = validateInputFile({ name: "notes.txt", size: 100, type: "text/plain" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("UNSUPPORTED_TYPE");
  });

  it("rejects empty files", () => {
    const result = validateInputFile({ name: "clip.mp4", size: 0, type: "video/mp4" });
    expect(result.code).toBe("EMPTY_FILE");
  });

  it("rejects files above the size limit", () => {
    const result = validateInputFile({
      name: "huge.mp4",
      size: LIMITS.maxFileSizeBytes + 1,
      type: "video/mp4",
    });
    expect(result.code).toBe("FILE_TOO_LARGE");
  });

  it("rejects a missing file", () => {
    expect(validateInputFile({ name: "", size: 0, type: "" }).code).toBe("NO_FILE");
  });
});

describe("validateDuration", () => {
  it("accepts durations within the limit", () => {
    expect(validateDuration(30).ok).toBe(true);
  });

  it("rejects durations over the limit", () => {
    expect(validateDuration(LIMITS.maxDurationSeconds + 1).code).toBe("DURATION_TOO_LONG");
  });

  it("rejects invalid durations", () => {
    expect(validateDuration(0).ok).toBe(false);
    expect(validateDuration(Number.NaN).ok).toBe(false);
  });
});
