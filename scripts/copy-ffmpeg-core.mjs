#!/usr/bin/env node
/**
 * Copies the FFmpeg.wasm single-threaded core into /public/ffmpeg so the
 * application can self-host it (no CDN, no third-party requests at runtime).
 *
 * This runs automatically on `postinstall` and can be re-run with
 * `npm run prepare:core`.
 */
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname));
const projectRoot = resolve(root, "..");
const destDir = join(projectRoot, "public", "ffmpeg");

/** Candidate locations of the core assets published by @ffmpeg/core. */
const candidates = [
  "node_modules/@ffmpeg/core/dist/umd",
  "node_modules/@ffmpeg/core/dist/esm",
];

/** Files we need in public/ffmpeg. */
const wanted = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

function findSourceDir() {
  for (const rel of candidates) {
    const abs = join(projectRoot, rel);
    if (existsSync(abs) && wanted.every((f) => existsSync(join(abs, f)))) {
      return abs;
    }
  }
  return null;
}

function main() {
  const srcDir = findSourceDir();
  if (!srcDir) {
    console.warn(
      "[ffmpeg-core] Could not find @ffmpeg/core assets. " +
        "Run `npm install` first. Skipping core copy.",
    );
    return;
  }

  mkdirSync(destDir, { recursive: true });

  const available = readdirSync(srcDir).filter((f) => statSync(join(srcDir, f)).isFile());
  const toCopy = wanted.filter((f) => available.includes(f));

  for (const file of toCopy) {
    const from = join(srcDir, file);
    const to = join(destDir, file);
    copyFileSync(from, to);
    const kb = (statSync(to).size / 1024).toFixed(0);
    console.log(`[ffmpeg-core] copied ${file} (${kb} KB) -> public/ffmpeg/`);
  }

  const missing = wanted.filter((f) => !toCopy.includes(f));
  if (missing.length > 0) {
    console.warn(`[ffmpeg-core] missing expected files: ${missing.join(", ")}`);
  }
}

main();
