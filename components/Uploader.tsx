"use client";

import { useCallback, useRef, useState } from "react";
import { ACCEPT_ATTRIBUTE } from "@/lib/config";
import { formatBytes } from "@/lib/format";

interface UploaderProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  fileName?: string | null;
  fileSize?: number;
}

export function Uploader({ onFile, disabled, fileName, fileSize }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div className="panel p-4 sm:p-5">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-5 py-10 text-center transition-colors",
          dragging
            ? "border-emerald-400 bg-emerald-500/10"
            : "border-white/10 bg-charcoal-700/40 hover:border-emerald-500/50 hover:bg-charcoal-700/70",
          disabled ? "pointer-events-none opacity-50" : "",
        ].join(" ")}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
            <path
              d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-100">
            Drop a video here or <span className="text-emerald-400">browse</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">MP4, MOV, M4V, WebM or MKV · up to 200 MB</p>
        </div>
      </div>

      {fileName ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-charcoal-700/50 px-3 py-2">
          <span className="truncate text-sm text-gray-200" title={fileName}>
            {fileName}
          </span>
          {typeof fileSize === "number" ? (
            <span className="shrink-0 font-mono text-xs text-gray-400">{formatBytes(fileSize)}</span>
          ) : null}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
