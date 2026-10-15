import { describe, expect, it } from "vitest";
import { OptimizerError, isCancelled, isOptimizerError, toOptimizerError } from "@/lib/errors";

describe("OptimizerError", () => {
  it("exposes a code and a friendly message", () => {
    const err = new OptimizerError("FILE_TOO_LARGE");
    expect(err.code).toBe("FILE_TOO_LARGE");
    expect(err.message).toMatch(/too large/i);
    expect(err.name).toBe("OptimizerError");
  });
});

describe("toOptimizerError", () => {
  it("passes through existing OptimizerErrors", () => {
    const original = new OptimizerError("ENCODE_FAILED");
    expect(toOptimizerError(original)).toBe(original);
  });

  it("maps out-of-memory messages", () => {
    expect(toOptimizerError(new Error("Cannot enlarge memory: out of memory")).code).toBe("MEMORY");
  });

  it("maps corrupt-file messages", () => {
    expect(toOptimizerError(new Error("moov atom not found")).code).toBe("CORRUPT_FILE");
  });

  it("maps cancellation messages", () => {
    expect(toOptimizerError(new Error("worker terminated")).code).toBe("CANCELLED");
    expect(isCancelled(new Error("Aborted"))).toBe(true);
  });

  it("maps cross-origin isolation failures to BROWSER_UNSUPPORTED", () => {
    expect(toOptimizerError(new Error("SharedArrayBuffer is not defined")).code).toBe("BROWSER_UNSUPPORTED");
  });

  it("falls back to UNKNOWN", () => {
    expect(toOptimizerError(new Error("boom")).code).toBe("UNKNOWN");
    expect(toOptimizerError("string failure").code).toBe("UNKNOWN");
  });

  it("type-guards OptimizerError instances", () => {
    expect(isOptimizerError(new OptimizerError("UNKNOWN"))).toBe(true);
    expect(isOptimizerError(new Error("x"))).toBe(false);
  });
});
