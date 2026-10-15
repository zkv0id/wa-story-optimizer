/**
 * Shared domain types for the WhatsApp Story Optimizer.
 */

export type PresetId = "balanced" | "maximum" | "small";

/** Video/audio characteristics extracted from the source file. */
export interface MediaMetadata {
  /** Container/format name reported by FFmpeg, e.g. "mov,mp4,m4a". */
  format: string;
  /** Video codec, e.g. "h264". `null` when the file has no video stream. */
  videoCodec: string | null;
  /** Audio codec, e.g. "aac". `null` when the file has no audio stream. */
  audioCodec: string | null;
  /** Duration in seconds. */
  duration: number;
  /** Frame width in pixels (before rotation is applied). */
  width: number;
  /** Frame height in pixels (before rotation is applied). */
  height: number;
  /** Frames per second, or `null` when it cannot be determined. */
  fps: number | null;
  /** Overall bitrate in bits per second, or `null`. */
  bitrate: number | null;
  /** Whether the source contains an audio stream. */
  hasAudio: boolean;
  /** Rotation metadata in degrees (0, 90, 180, 270), normalized. */
  rotation: number;
}

/** Result of validating a candidate input file. */
export interface InputValidationResult {
  ok: boolean;
  /** Machine-readable error code when `ok` is false. */
  code?: InputErrorCode;
  /** Human-readable message suitable for display. */
  message?: string;
}

export type InputErrorCode =
  | "NO_FILE"
  | "UNSUPPORTED_TYPE"
  | "FILE_TOO_LARGE"
  | "DURATION_TOO_LONG"
  | "EMPTY_FILE";

/** A resolved encode profile derived from a preset plus source metadata. */
export interface EncodeProfile {
  id: PresetId;
  label: string;
  description: string;
  /** Constant Rate Factor for libx264 (lower = higher quality). */
  crf: number;
  /** libx264 encoder preset. */
  x264Preset: string;
  /**
   * Maximum width/height box used for downscaling. Never used to upscale:
   * the source resolution always wins when it is smaller.
   */
  scaleBox: number;
  /** Optional FPS ceiling. `null` keeps the source framerate untouched. */
  fpsCap: number | null;
  /** AAC audio bitrate in kbps (ignored when the source has no audio). */
  audioBitrateKbps: number;
  /** Apply a conservative unsharp mask to recover perceived sharpness. */
  denoiseSharpen: boolean;
}

/** Full description of a processing job, produced after probing. */
export interface OptimizeJob {
  id: string;
  inputName: string;
  outputName: string;
  preset: PresetId;
  metadata: MediaMetadata;
}

/** Output of the encode + validation stage. */
export interface EncodeResult {
  outputName: string;
  blob: Blob;
  url: string;
  size: number;
  metadata: MediaMetadata;
  elapsedMs: number;
  profile: EncodeProfile;
}

export type JobPhase =
  | "idle"
  | "validating"
  | "loading-engine"
  | "probing"
  | "planning"
  | "encoding"
  | "validating-output"
  | "done"
  | "error"
  | "cancelled";

export interface JobProgress {
  phase: JobPhase;
  /** 0..1 when known, otherwise `null`. */
  ratio: number | null;
  message: string;
}
