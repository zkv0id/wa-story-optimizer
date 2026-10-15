/**
 * Central limits and shared constants.
 *
 * These are deliberately conservative because FFmpeg.wasm runs entirely in
 * the browser and mobile devices have limited RAM. Keeping a single job at a
 * time plus a hard input ceiling prevents the tab from being killed.
 */

export const LIMITS = {
  /** Maximum accepted input size in bytes (200 MB). */
  maxFileSizeBytes: 200 * 1024 * 1024,
  /** Maximum accepted input duration in seconds (3 minutes). */
  maxDurationSeconds: 180,
  /** Only one encode may run at a time. */
  maxConcurrentJobs: 1,
} as const;

/** MIME types we accept (FFmpeg itself can decode far more). */
export const ACCEPTED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/x-matroska",
  "application/octet-stream",
] as const;

/** Extensions used as a fallback when the browser reports no MIME type. */
export const ACCEPTED_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".mkv",
] as const;

export const ACCEPT_ATTRIBUTE = "video/mp4,video/quicktime,video/webm,video/x-m4v,video/x-matroska,.mp4,.mov,.m4v,.webm,.mkv";

export const PRESET_LABELS: Record<string, string> = {
  balanced: "Balanced",
  maximum: "Maximum Quality",
  small: "Small File",
};
