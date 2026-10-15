"use client";

interface PreviewPlayerProps {
  label: string;
  src: string | null;
  accent?: "neutral" | "emerald";
  note?: string;
}

export function PreviewPlayer({ label, src, accent = "neutral", note }: PreviewPlayerProps) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <span className="text-sm font-semibold text-gray-100">{label}</span>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            accent === "emerald"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-white/5 text-gray-400",
          ].join(" ")}
        >
          {accent === "emerald" ? "Optimized" : "Source"}
        </span>
      </div>

      <div className="relative flex aspect-video items-center justify-center bg-black/60">
        {src ? (
          <video
            key={src}
            src={src}
            controls
            playsInline
            muted
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs text-gray-600">No preview</span>
        )}
      </div>

      {note ? (
        <p className="border-t border-white/5 px-4 py-2 text-[11px] text-gray-500">{note}</p>
      ) : null}
    </div>
  );
}
