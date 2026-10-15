import type { InputErrorCode } from "@/types";

/** Machine-readable codes for every failure mode this app can surface. */
export type OptimizerErrorCode =
  | InputErrorCode
  | "BROWSER_UNSUPPORTED"
  | "ENGINE_LOAD_FAILED"
  | "PROBE_FAILED"
  | "CORRUPT_FILE"
  | "NO_VIDEO_STREAM"
  | "MEMORY"
  | "ENCODE_FAILED"
  | "OUTPUT_INVALID"
  | "CANCELLED"
  | "UNKNOWN";

const FRIENDLY: Record<OptimizerErrorCode, string> = {
  NO_FILE: "No file selected.",
  UNSUPPORTED_TYPE: "Unsupported file type. Use an MP4, MOV, WebM, M4V or MKV video.",
  FILE_TOO_LARGE: "File is too large to process safely on a mobile device.",
  DURATION_TOO_LONG: "Video is longer than the supported maximum duration.",
  EMPTY_FILE: "The selected file is empty or could not be read.",
  BROWSER_UNSUPPORTED:
    "This browser does not support the in-browser video engine. Try the latest Chrome on Android.",
  ENGINE_LOAD_FAILED: "Failed to load the video engine. Check your connection and try again.",
  PROBE_FAILED: "Could not read media information from this file.",
  CORRUPT_FILE: "The file appears to be corrupt or truncated.",
  NO_VIDEO_STREAM: "No video stream found in this file.",
  MEMORY: "Ran out of memory while processing. Try a shorter or smaller video.",
  ENCODE_FAILED: "Encoding failed. The file may use an unsupported codec.",
  OUTPUT_INVALID: "The encoded output failed verification.",
  CANCELLED: "Processing was cancelled.",
  UNKNOWN: "Something went wrong while processing this file.",
};

/** Error type carrying a stable code plus a user-friendly message. */
export class OptimizerError extends Error {
  readonly code: OptimizerErrorCode;
  /** Optional low-level detail (e.g. FFmpeg log tail) for debugging. */
  readonly detail?: string;

  constructor(code: OptimizerErrorCode, detail?: string) {
    super(FRIENDLY[code]);
    this.name = "OptimizerError";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Maps arbitrary thrown values to an {@link OptimizerError}, inspecting
 * message text to distinguish memory, corrupt-file and cancellation cases
 * that FFmpeg.wasm reports only through strings.
 */
export function toOptimizerError(error: unknown): OptimizerError {
  if (error instanceof OptimizerError) return error;

  const raw = error instanceof Error ? error.message : String(error);
  const text = raw.toLowerCase();

  if (
    text.includes("out of memory") ||
    /\boom\b/.test(text) ||
    text.includes("array buffer allocation") ||
    text.includes("memory access out of bounds")
  ) {
    return new OptimizerError("MEMORY", raw);
  }
  if (text.includes("invalid data found") || text.includes("moov atom not found") || text.includes("corrupt")) {
    return new OptimizerError("CORRUPT_FILE", raw);
  }
  if (text.includes("cancelled") || text.includes("aborted") || text.includes("terminated")) {
    return new OptimizerError("CANCELLED", raw);
  }
  if (text.includes("sharedarraybuffer") || text.includes("cross-origin isolation")) {
    return new OptimizerError("BROWSER_UNSUPPORTED", raw);
  }
  return new OptimizerError("UNKNOWN", raw);
}

export function isCancelled(error: unknown): boolean {
  return toOptimizerError(error).code === "CANCELLED";
}

/** Type guard for {@link OptimizerError}. */
export function isOptimizerError(error: unknown): error is OptimizerError {
  return error instanceof OptimizerError;
}
