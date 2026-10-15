/** File data returned by FFmpeg.wasm's readFile. */
export type FileData = Uint8Array | string;

/** Progress event payload emitted by FFmpeg.wasm. */
export interface ProgressEvent {
  /** 0..1 when known. */
  progress: number;
  /** Processed time in microseconds. */
  time: number;
}

/** Log event payload emitted by FFmpeg.wasm. */
export interface LogEvent {
  type: string;
  message: string;
}

/**
 * Structural interface describing the subset of FFmpeg.wasm this app uses.
 * Keeping it minimal makes the encode/validate/probe modules decoupled from
 * the concrete package and trivially mockable.
 */
export interface Engine {
  exec(args: string[], timeout?: number): Promise<number>;
  writeFile(path: string, data: Uint8Array): Promise<boolean>;
  readFile(path: string): Promise<FileData>;
  deleteFile(path: string): Promise<boolean>;
  on(event: "log", cb: (e: LogEvent) => void): void;
  on(event: "progress", cb: (e: ProgressEvent) => void): void;
  off(event: "log", cb: (e: LogEvent) => void): void;
  off(event: "progress", cb: (e: ProgressEvent) => void): void;
  terminate(): void;
}
