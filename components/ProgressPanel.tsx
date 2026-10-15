"use client";

import { formatSeconds } from "@/lib/format";
import type { JobPhase } from "@/types";

interface ProgressPanelProps {
  phase: JobPhase;
  ratio: number | null;
  message: string;
  elapsedMs: number;
  onCancel: () => void;
  canCancel: boolean;
}

const PHASE_ORDER: JobPhase[] = [
  "validating",
  "loading-engine",
  "probing",
  "planning",
  "encoding",
  "validating-output",
  "done",
];

export function ProgressPanel({
  phase,
  ratio,
  message,
  elapsedMs,
  onCancel,
  canCancel,
}: ProgressPanelProps) {
  const activeIndex = PHASE_ORDER.indexOf(phase);
  const percent = ratio == null ? null : Math.round(ratio * 100);

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-100">{message || "Working…"}</span>
        <span className="font-mono text-xs text-gray-400">
          {percent == null ? "" : `${percent}%`} · {formatSeconds(elapsedMs)}
        </span>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-label="Processing progress"
      >
        <div
          className={[
            "h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-300",
            percent == null ? "w-1/3 animate-pulse" : "",
          ].join(" ")}
          style={percent == null ? undefined : { width: `${percent}%` }}
        />
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {PHASE_ORDER.slice(0, 6).map((p, i) => {
          const done = activeIndex > i;
          const current = activeIndex === i;
          return (
            <li key={p} className="flex items-center gap-2 text-[11px]">
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full",
                  done ? "bg-emerald-400" : current ? "bg-emerald-400 animate-ping" : "bg-white/15",
                ].join(" ")}
                aria-hidden
              />
              <span className={done || current ? "text-gray-300" : "text-gray-600"}>
                {p.replace("-", " ")}
              </span>
            </li>
          );
        })}
      </ol>

      {canCancel ? (
        <button type="button" className="btn-ghost mt-4 w-full" onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </div>
  );
}
