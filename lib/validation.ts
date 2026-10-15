import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  LIMITS,
} from "@/lib/config";
import type { InputValidationResult } from "@/types";

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/**
 * Validates that a file's declared type and size are acceptable before any
 * expensive work happens. Duration is validated separately once the file has
 * been probed, because the browser API does not expose it synchronously.
 */
export function validateInputFile(file: {
  name: string;
  size: number;
  type: string;
}): InputValidationResult {
  if (!file || !file.name) {
    return { ok: false, code: "NO_FILE", message: "No file selected." };
  }

  if (file.size <= 0) {
    return { ok: false, code: "EMPTY_FILE", message: "The selected file is empty." };
  }

  const mime = (file.type || "").toLowerCase();
  const ext = extensionOf(file.name);
  const mimeAccepted = mime === "" || (ACCEPTED_MIME_TYPES as readonly string[]).includes(mime);
  const extAccepted = (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);

  if (!mimeAccepted && !extAccepted) {
    return {
      ok: false,
      code: "UNSUPPORTED_TYPE",
      message: `Unsupported file type "${file.type || ext || "unknown"}".`,
    };
  }

  if (file.size > LIMITS.maxFileSizeBytes) {
    const mb = Math.round(LIMITS.maxFileSizeBytes / (1024 * 1024));
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `File is larger than the ${mb} MB limit for in-browser processing.`,
    };
  }

  return { ok: true };
}

/** Validates duration (seconds) against the configured maximum. */
export function validateDuration(durationSeconds: number): InputValidationResult {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { ok: false, code: "PROBE_FAILED" as never, message: "Could not determine video duration." };
  }
  if (durationSeconds > LIMITS.maxDurationSeconds) {
    return {
      ok: false,
      code: "DURATION_TOO_LONG",
      message: `Video is longer than the ${Math.round(
        LIMITS.maxDurationSeconds / 60,
      )} minute limit.`,
    };
  }
  return { ok: true };
}
