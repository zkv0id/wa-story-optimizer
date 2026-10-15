/** Browser-only helpers: quick metadata probing and Web Share integration. */

export interface QuickMetadata {
  duration: number;
  width: number;
  height: number;
}

/**
 * Reads basic duration/dimension metadata using an HTMLVideoElement. This is
 * fast and works before the (heavier) FFmpeg engine loads, but it does not
 * expose codec or fps information; those come from the FFmpeg probe.
 */
export function readQuickMetadata(url: string, timeoutMs = 8000): Promise<QuickMetadata> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("No DOM"));
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out reading metadata"));
    }, timeoutMs);

    function cleanup() {
      window.clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
    }

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      cleanup();
      resolve({ duration, width, height });
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not decode video metadata"));
    };
  });
}

/** Returns true when the browser can share this file via the Web Share API. */
export function canShareFile(file: File): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Shares a file via the Web Share API. Resolves false when unsupported. */
export async function shareFile(file: File, title: string, text?: string): Promise<boolean> {
  if (!canShareFile(file)) return false;
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  try {
    await nav.share?.({ files: [file], title, text });
    return true;
  } catch {
    return false;
  }
}

/** Triggers a client-side download for the given URL. */
export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
