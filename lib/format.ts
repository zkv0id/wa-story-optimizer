/** Formatting helpers shared by UI components. */

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatFps(fps: number | null): string {
  if (fps == null || !Number.isFinite(fps)) return "—";
  return `${Number.isInteger(fps) ? fps : fps.toFixed(2)} fps`;
}

export function formatResolution(width: number, height: number): string {
  if (!width || !height) return "—";
  return `${width}×${height}`;
}

export function formatBitrate(bps: number | null): string {
  if (bps == null || !Number.isFinite(bps)) return "—";
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  return `${Math.round(bps / 1000)} kbps`;
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function sizeDeltaPercent(original: number, optimized: number): number {
  if (original <= 0) return 0;
  return ((optimized - original) / original) * 100;
}
