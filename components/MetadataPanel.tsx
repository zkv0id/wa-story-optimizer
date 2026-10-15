"use client";

import {
  formatBitrate,
  formatBytes,
  formatDuration,
  formatFps,
  formatResolution,
} from "@/lib/format";
import type { MediaMetadata } from "@/types";

interface MetadataPanelProps {
  title: string;
  metadata: Partial<MediaMetadata> | null;
  sizeBytes?: number | null;
  accent?: "neutral" | "emerald";
  emptyHint?: string;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 last:border-b-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="truncate font-mono text-xs text-gray-200" title={value}>
        {value}
      </span>
    </div>
  );
}

export function MetadataPanel({
  title,
  metadata,
  sizeBytes,
  accent = "neutral",
  emptyHint = "Available after analysis",
}: MetadataPanelProps) {
  const has = metadata && (metadata.width || metadata.duration || metadata.videoCodec);

  return (
    <div className="panel p-4 sm:p-5">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-100">
        <span
          className={[
            "h-2 w-2 rounded-full",
            accent === "emerald" ? "bg-emerald-400" : "bg-gray-500",
          ].join(" ")}
          aria-hidden
        />
        {title}
      </h3>

      {!has ? (
        <p className="py-3 text-xs text-gray-500">{emptyHint}</p>
      ) : (
        <div>
          <Row
            label="Resolution"
            value={formatResolution(metadata?.width ?? 0, metadata?.height ?? 0)}
          />
          <Row label="FPS" value={formatFps(metadata?.fps ?? null)} />
          <Row label="Duration" value={formatDuration(metadata?.duration ?? 0)} />
          <Row label="Size" value={typeof sizeBytes === "number" ? formatBytes(sizeBytes) : "—"} />
          <Row label="Video codec" value={(metadata?.videoCodec ?? "—").toUpperCase()} />
          <Row
            label="Audio codec"
            value={metadata?.hasAudio ? (metadata?.audioCodec ?? "—").toUpperCase() : "None"}
          />
          <Row label="Bitrate" value={formatBitrate(metadata?.bitrate ?? null)} />
          <Row label="Rotation" value={`${metadata?.rotation ?? 0}°`} />
        </div>
      )}
    </div>
  );
}
