"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Uploader } from "@/components/Uploader";
import { PresetSelector } from "@/components/PresetSelector";
import { MetadataPanel } from "@/components/MetadataPanel";
import { PreviewPlayer } from "@/components/PreviewPlayer";
import { ProgressPanel } from "@/components/ProgressPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { Notice, ErrorBanner } from "@/components/Notice";
import { optimizeVideo } from "@/lib/optimize";
import { validateInputFile } from "@/lib/validation";
import { releaseObjectUrl } from "@/lib/ffmpeg";
import { canShareFile, readQuickMetadata, shareFile, triggerDownload } from "@/lib/browser";
import { estimateOutputBytes } from "@/lib/estimate";
import { selectProfile } from "@/lib/ffmpeg/profiles";
import { isOptimizerError, OptimizerError } from "@/lib/errors";
import { PROFILES } from "@/lib/ffmpeg/profiles";
import type { EncodeResult, JobPhase, MediaMetadata, PresetId } from "@/types";

type RunState = "idle" | "running" | "done" | "error";

const ACTIVE_PHASES: JobPhase[] = [
  "validating",
  "loading-engine",
  "probing",
  "planning",
  "encoding",
  "validating-output",
];

export function OptimizerApp() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceMeta, setSourceMeta] = useState<Partial<MediaMetadata> | null>(null);
  const [preset, setPreset] = useState<PresetId>("balanced");
  const [sharpen, setSharpen] = useState(false);

  const [phase, setPhase] = useState<JobPhase>("idle");
  const [message, setMessage] = useState("");
  const [ratio, setRatio] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const [result, setResult] = useState<EncodeResult | null>(null);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const runState: RunState = error ? "error" : result ? "done" : ACTIVE_PHASES.includes(phase) ? "running" : "idle";

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      releaseObjectUrl(sourceUrlRef.current);
      releaseObjectUrl(resultUrlRef.current);
    };
  }, []);

  const clearResult = useCallback(() => {
    releaseObjectUrl(resultUrlRef.current);
    resultUrlRef.current = null;
    setResult(null);
  }, []);

  const handleFile = useCallback(
    (incoming: File) => {
      const validation = validateInputFile({ name: incoming.name, size: incoming.size, type: incoming.type });
      if (!validation.ok) {
        setError({ message: validation.message ?? "Invalid file." });
        return;
      }

      abortRef.current?.abort();
      clearResult();
      releaseObjectUrl(sourceUrlRef.current);

      const url = URL.createObjectURL(incoming);
      sourceUrlRef.current = url;
      setSourceUrl(url);
      setFile(incoming);
      setSourceMeta({});
      setError(null);
      setPhase("idle");
      setMessage("");
      setRatio(null);
      setElapsedMs(0);

      readQuickMetadata(url)
        .then((quick) => {
          setSourceMeta((prev) => ({ ...(prev ?? {}), ...quick }));
        })
        .catch(() => {
          /* Full probe during the run will fill this in. */
        });
    },
    [clearResult],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleOptimize = useCallback(async () => {
    if (!file || runState === "running") return;
    clearResult();
    setError(null);
    setRatio(null);
    setElapsedMs(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const encoded = await optimizeVideo({
        file,
        preset,
        sharpen,
        signal: controller.signal,
        onPhase: (nextPhase, msg) => {
          setPhase(nextPhase);
          setMessage(msg);
        },
        onProgress: (r, ms) => {
          setRatio(r);
          setElapsedMs(ms);
        },
        onMetadata: (meta) => {
          setSourceMeta(meta);
        },
      });

      resultUrlRef.current = encoded.url;
      setResult(encoded);
      setPhase("done");
      setMessage("Completed");
      setRatio(1);
    } catch (err) {
      const oe = isOptimizerError(err) ? (err as OptimizerError) : null;
      if (oe?.code === "CANCELLED") {
        setPhase("cancelled");
        setMessage("Processing cancelled.");
        return;
      }
      setPhase("error");
      setError({
        message: oe?.message ?? "Something went wrong while processing this file.",
        detail: oe?.detail,
      });
    } finally {
      abortRef.current = null;
    }
  }, [file, preset, sharpen, runState, clearResult]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    clearResult();
    releaseObjectUrl(sourceUrlRef.current);
    sourceUrlRef.current = null;
    setSourceUrl(null);
    setFile(null);
    setSourceMeta(null);
    setError(null);
    setPhase("idle");
    setMessage("");
    setRatio(null);
    setElapsedMs(0);
  }, [clearResult]);

  const downloadName = useMemo(() => {
    if (!result || !file) return "optimized.mp4";
    const base = file.name.replace(/\.[^.]+$/, "");
    return `${base}-wa-${preset}.mp4`;
  }, [result, file, preset]);

  const handleDownload = useCallback(() => {
    if (result) triggerDownload(result.url, downloadName);
  }, [result, downloadName]);

  const handleShare = useCallback(async () => {
    if (!result) return;
    const shareName = downloadName;
    const shareFileObj = new File([result.blob], shareName, { type: "video/mp4" });
    const ok = await shareFile(shareFileObj, "Optimized video", "Optimized for WhatsApp Status");
    if (!ok) triggerDownload(result.url, shareName);
  }, [result, downloadName]);

  const shareSupported = useMemo(() => {
    if (!result) return false;
    const probe = new File([result.blob], downloadName, { type: "video/mp4" });
    return canShareFile(probe);
  }, [result, downloadName]);

  const estimateBytes = useMemo(() => {
    if (!sourceMeta?.width || !sourceMeta?.height || !sourceMeta?.duration) return null;
    const meta: MediaMetadata = {
      format: sourceMeta.format ?? "",
      videoCodec: sourceMeta.videoCodec ?? null,
      audioCodec: sourceMeta.audioCodec ?? null,
      duration: sourceMeta.duration,
      width: sourceMeta.width,
      height: sourceMeta.height,
      fps: sourceMeta.fps ?? null,
      bitrate: sourceMeta.bitrate ?? null,
      hasAudio: sourceMeta.hasAudio ?? true,
      rotation: sourceMeta.rotation ?? 0,
    };
    const profile = selectProfile(preset, meta);
    return estimateOutputBytes(profile, meta);
  }, [sourceMeta, preset]);

  const canStart = Boolean(file) && runState !== "running";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <header className="mb-6 flex flex-col gap-2 sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
              <path
                d="M12 3v18M5 8l7-5 7 5M5 8v8l7 5 7-5V8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-gray-50 sm:text-xl">
              WhatsApp Story Optimizer
            </h1>
            <p className="text-xs text-gray-500">
              Cleaner video quality before WhatsApp Status compresses it — processed entirely in your browser.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <Uploader
            onFile={handleFile}
            disabled={runState === "running"}
            fileName={file?.name}
            fileSize={file?.size}
          />

          <PresetSelector value={preset} onChange={setPreset} disabled={runState === "running"} />

          <div className="panel flex items-center justify-between gap-3 p-4 sm:p-5">
            <div>
              <p className="text-sm font-semibold text-gray-100">Conservative sharpening</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Optional light unsharp mask. Off by default to protect fine detail.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sharpen}
              disabled={runState === "running"}
              onClick={() => setSharpen((v) => !v)}
              className={[
                "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
                sharpen ? "bg-emerald-500" : "bg-white/10",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                  sharpen ? "translate-x-[22px]" : "translate-x-0.5",
                ].join(" ")}
              />
              <span className="sr-only">Toggle sharpening</span>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PreviewPlayer
              label="Original"
              src={sourceUrl}
              note={file ? `${file.name} · ${PROFILES[preset].label} preset selected` : undefined}
            />
            <PreviewPlayer
              label="Optimized"
              src={result?.url ?? null}
              accent="emerald"
              note={result ? "H.264 MP4, ready to download or share." : "Your optimized preview appears here."}
            />
          </div>

          {error ? <ErrorBanner message={error.message} detail={error.detail} /> : null}

          {phase === "cancelled" ? (
            <Notice tone="warning" title="Cancelled">
              Processing was stopped. Your original file is untouched.
            </Notice>
          ) : null}

          {runState === "running" ? (
            <ProgressPanel
              phase={phase}
              ratio={ratio}
              message={message}
              elapsedMs={elapsedMs}
              onCancel={handleCancel}
              canCancel
            />
          ) : null}

          {canStart ? (
            <button type="button" className="btn-primary py-3 text-base" onClick={handleOptimize}>
              {runState === "done" ? "Optimize again" : "Optimize for WhatsApp Status"}
            </button>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <MetadataPanel
            title="Source metadata"
            metadata={sourceMeta}
            sizeBytes={file?.size ?? null}
            emptyHint="Select a file to see its properties."
          />

          {result ? (
            <ResultPanel
              result={result}
              originalSize={file?.size ?? 0}
              canShare={shareSupported}
              onDownload={handleDownload}
              onShare={handleShare}
              onReset={handleReset}
            />
          ) : null}

          {estimateBytes != null && !result ? (
            <div className="panel p-4">
              <p className="label">Rough size estimate</p>
              <p className="mt-1 font-mono text-lg text-gray-100">
                {formatEstimate(estimateBytes)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Heuristic estimate only — not a benchmark. Actual size depends on the source content.
              </p>
            </div>
          ) : null}

          <Notice tone="warning" title="WhatsApp still re-compresses">
            This tool prepares a cleaner, correctly oriented H.264 MP4, but WhatsApp applies its own
            compression afterwards. Final quality cannot be guaranteed, and no preset here is
            objectively “best” without benchmarking your own files.
          </Notice>

          <Notice tone="info" title="100% on-device">
            Files are decoded and encoded locally with FFmpeg.wasm. Nothing is uploaded, stored or
            sent to any server. Original files are never modified.
          </Notice>
        </aside>
      </div>
    </div>
  );
}

function formatEstimate(bytes: number): string {
  if (bytes >= 1024 * 1024) return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `~${Math.max(1, Math.round(bytes / 1024))} KB`;
}
