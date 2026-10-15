"use client";

import { formatBytes, formatSeconds, sizeDeltaPercent } from "@/lib/format";
import type { EncodeResult } from "@/types";

interface ResultPanelProps {
  result: EncodeResult;
  originalSize: number;
  canShare: boolean;
  onDownload: () => void;
  onShare: () => void;
  onReset: () => void;
}

export function ResultPanel({
  result,
  originalSize,
  canShare,
  onDownload,
  onShare,
  onReset,
}: ResultPanelProps) {
  const delta = sizeDeltaPercent(originalSize, result.size);
  const reduced = delta <= 0;

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-100">Ready to share</h3>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
          {result.profile.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-white/5 bg-charcoal-700/40 p-2">
          <p className="label">Original</p>
          <p className="mt-1 font-mono text-sm text-gray-200">{formatBytes(originalSize)}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-charcoal-700/40 p-2">
          <p className="label">Optimized</p>
          <p className="mt-1 font-mono text-sm text-gray-200">{formatBytes(result.size)}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-charcoal-700/40 p-2">
          <p className="label">Change</p>
          <p
            className={[
              "mt-1 font-mono text-sm",
              reduced ? "text-emerald-400" : "text-amber-400",
            ].join(" ")}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        Encoded in {formatSeconds(result.elapsedMs)} · H.264 + AAC MP4 · faststart enabled
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn-primary flex-1" onClick={onDownload}>
          Download MP4
        </button>
        <button
          type="button"
          className="btn-ghost flex-1"
          onClick={onShare}
          disabled={!canShare}
          title={canShare ? "Share via device" : "Web Share API not supported on this browser"}
        >
          Share
        </button>
      </div>

      <button
        type="button"
        className="mt-2 w-full text-center text-xs text-gray-500 underline-offset-4 hover:text-gray-300 hover:underline"
        onClick={onReset}
      >
        Optimize another file
      </button>
    </div>
  );
}
