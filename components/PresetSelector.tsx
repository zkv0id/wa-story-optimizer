"use client";

import { PROFILES, PRESET_ORDER } from "@/lib/ffmpeg/profiles";
import type { PresetId } from "@/types";

interface PresetSelectorProps {
  value: PresetId;
  onChange: (preset: PresetId) => void;
  disabled?: boolean;
}

const HINTS: Record<PresetId, string> = {
  balanced: "CRF 23 · up to 1080p · AAC 128k",
  maximum: "CRF 18 · up to 1080p retained · AAC 192k",
  small: "CRF 28 · up to 720p · 30 fps cap · AAC 96k",
};

export function PresetSelector({ value, onChange, disabled }: PresetSelectorProps) {
  return (
    <div className="panel p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-100">Quality preset</h2>
        <span className="label">4:5 / 9:16 friendly</span>
      </div>

      <div role="radiogroup" aria-label="Quality preset" className="grid gap-2 sm:grid-cols-3">
        {PRESET_ORDER.map((id) => {
          const profile = PROFILES[id];
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(id)}
              className={[
                "rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 disabled:opacity-50",
                active
                  ? "border-emerald-400/70 bg-emerald-500/10"
                  : "border-white/10 bg-charcoal-700/40 hover:border-white/20",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-100">{profile.label}</span>
                <span
                  className={[
                    "h-3 w-3 rounded-full border",
                    active ? "border-emerald-400 bg-emerald-400" : "border-white/30",
                  ].join(" ")}
                  aria-hidden
                />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">{profile.description}</p>
              <p className="mt-2 font-mono text-[11px] text-gray-500">{HINTS[id]}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
