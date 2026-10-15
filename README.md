# WhatsApp Story Optimizer

A production-ready, **100% client-side** web app that prepares photos and videos for
WhatsApp Status so their visual quality survives WhatsApp's own re-compression better.

Everything runs in the browser with **FFmpeg.wasm**. There is **no backend, no database,
no login, no API keys and no media uploads**. Your files never leave the device.

> **Important:** WhatsApp always re-compresses media you post. This tool produces a
> correctly oriented, cleanly encoded H.264/AAC MP4 that gives WhatsApp a better source
> to work with, but the final quality **cannot be guaranteed**. No preset here is
> claimed to be objectively "best" — see the [A/B testing guide](#ab-testing-guide).

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Local setup](#local-setup)
- [Available scripts](#available-scripts)
- [Encoding profiles](#encoding-profiles)
- [FFmpeg.wasm assets & Vercel](#ffmpegwasm-assets--vercel)
- [Deploying to Vercel](#deploying-to-vercel)
- [Testing](#testing)
- [Browser support & limitations](#browser-support--limitations)
- [Performance & security](#performance--security)
- [A/B testing guide](#ab-testing-guide)
- [FAQ / troubleshooting](#faq--troubleshooting)

---

## Features

- **Drag-and-drop uploader** plus a file picker (MP4, MOV, M4V, WebM, MKV; ≤ 200 MB, ≤ 3 min).
- **Original vs. optimized preview** side by side.
- **Metadata panel**: resolution, FPS, duration, size, video/audio codec, bitrate, rotation.
- **Three quality presets**: Balanced, Maximum Quality, Small File.
- **Live progress** with phase indicators, elapsed time, cancel button and a rough
  output-size estimate.
- **Rotation normalisation** and aspect-ratio preservation with **no automatic cropping**.
- **H.264 + AAC MP4 with `+faststart`**, single-thread WASM core (no COOP/COEP needed).
- **Download** the MP4 and **Share** via the Web Share API when the browser supports it.
- **Clear error handling** for codec, memory, unsupported-browser and corrupt-file cases.
- Premium dark UI (charcoal + emerald), mobile-first, tuned for Android.

## Tech stack

| Concern        | Choice                                   |
| -------------- | ---------------------------------------- |
| Framework      | Next.js (App Router) + TypeScript        |
| Styling        | Tailwind CSS                             |
| Media engine   | FFmpeg.wasm (`@ffmpeg/ffmpeg` + `@ffmpeg/core`, single-thread) |
| Testing        | Vitest                                   |
| Hosting        | Vercel (static + assets, no server work) |

## How it works

1. **Validate** file type, size and (after probing) duration.
2. **Lazily load** FFmpeg.wasm on first use; show engine loading status.
3. **Probe** the source for streams, resolution, FPS, duration, bitrate and rotation by
   parsing FFmpeg's own log output (`parseProbeLogs`), because FFmpeg.wasm ships no ffprobe.
4. **Select a profile** from the preset + source characteristics.
5. **Normalise rotation** (FFmpeg auto-rotates on transcode) and scale with a
   **downscale-only** box that preserves aspect ratio and even dimensions — never upscales,
   never crops.
6. **Encode** H.264 MP4 with CRF-based quality, an appropriate x264 preset, `yuv420p`,
   `+faststart`, and AAC audio (or `-an` when there is no audio track).
7. Optional **conservative sharpening** is off by default and only ever applied on request.
8. **Verify** the output by re-probing it (codec, duration, dimensions, no upscale).
9. **Clean up** the virtual filesystem, object URLs and the worker.

## Project structure

```
app/                      # App Router pages + layout + global styles
components/               # Uploader, preview, preset selector, progress, result, metadata, notices
lib/
  config.ts               # Limits and accepted types
  validation.ts           # Input + duration validation
  errors.ts               # Typed error codes and friendly messages
  format.ts               # Formatting helpers
  estimate.ts             # Rough output-size heuristic
  browser.ts              # Web Share API + download + quick metadata
  optimize.ts             # End-to-end orchestration
  ffmpeg/
    loader.ts             # Lazy, cached FFmpeg.wasm loader + teardown
    probe.ts              # FFmpeg log parser + probeFile()
    profiles.ts           # Central profile definitions + selectProfile()
    commands.ts           # Structured FFmpeg argument builder
    encode.ts             # Write → encode → verify → Blob
    validate.ts           # Output verification
    cleanup.ts            # Virtual FS / object URL / worker cleanup
    types.ts              # Structural Engine interface
types/                    # Shared domain types
tests/                    # Vitest unit tests (pure logic)
scripts/copy-ffmpeg-core.mjs  # Copies core into public/ffmpeg on install
```

## Local setup

Requirements: Node.js ≥ 18.18 and npm.

```bash
git clone <your-repo-url> wa-story-optimizer
cd wa-story-optimizer
npm install          # also copies the FFmpeg core into public/ffmpeg
npm run dev          # http://localhost:3000
```

If you ever need to re-copy the core manually:

```bash
npm run prepare:core
```

### Environment variables

None are required. There are no secrets, keys or server endpoints, so no `.env.example`
is shipped. The app is fully static apart from the FFmpeg core assets in `public/`.

## Available scripts

| Script                | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | Start the dev server                            |
| `npm run build`       | Production build                                |
| `npm start`           | Serve the production build                      |
| `npm run lint`        | ESLint (`next lint`)                            |
| `npm run typecheck`   | TypeScript, no emit                             |
| `npm test`            | Run unit tests once (Vitest)                    |
| `npm run test:watch`  | Unit tests in watch mode                         |
| `npm run prepare:core`| Copy the FFmpeg.wasm core into `public/ffmpeg`  |

## Encoding profiles

Defined centrally in `lib/ffmpeg/profiles.ts`.

| Preset               | CRF | x264 preset | Scale box  | FPS        | Audio    |
| -------------------- | --- | ----------- | ---------- | ---------- | -------- |
| **Maximum Quality**  | 18  | `faster`    | ≤ 1920 px  | keep source| AAC 192k |
| **Balanced**         | 23  | `veryfast`  | ≤ 1080 px  | keep source| AAC 128k |
| **Small File**       | 28  | `veryfast`  | ≤ 720 px   | cap 30 fps | AAC 96k  |

Rules enforced by `selectProfile`:

- **Never upscale** — the scale box is clamped to the source's largest side; sources
  smaller than the box pass through unchanged.
- **Keep source FPS** for Balanced and Maximum; only Small File caps at 30 fps (an
  explicit size trade-off).
- **Scale box** uses `force_original_aspect_ratio=decrease` + `force_divisible_by=2`, so
  aspect ratio is preserved and H.264's even-dimension requirement is met without cropping.

CRF is the primary quality lever; x264 presets are biased toward `veryfast`/`faster`
because CPU is scarce inside a browser WASM sandbox.

## FFmpeg.wasm assets & Vercel

This project **self-hosts** the FFmpeg core instead of using a CDN:

- `scripts/copy-ffmpeg-core.mjs` (run automatically on `postinstall`) copies
  `ffmpeg-core.js` (~110 KB) and `ffmpeg-core.wasm` (~31 MB) from `@ffmpeg/core` into
  `public/ffmpeg/`.
- `lib/ffmpeg/loader.ts` fetches those same-origin files and wraps them in Blob URLs via
  `toBlobURL`, then calls `ffmpeg.load({ coreURL, wasmURL })`.
- `next.config.mjs` sets a long-lived immutable `Cache-Control` header on `/ffmpeg/*`, so
  the large WASM binary is downloaded once and cached by the browser.

Because the **single-threaded** core is used, there is **no SharedArrayBuffer /
cross-origin-isolation requirement**, which keeps deployments simple on Vercel and keeps
the app working in standard mobile browsers.

`public/ffmpeg/` is git-ignored (generated on install). Vercel runs `npm install` during
build, so the assets are present before `next build`.

## Deploying to Vercel

1. Push the repository to GitHub.
2. In Vercel: **Add New → Project → Import** your repository.
3. Framework preset: **Next.js** (auto-detected). Leave build/output settings at defaults
   (`npm run build`, output `.next`). **No environment variables are needed.**
4. Deploy.

The app is a static route — no serverless functions, no database, no edge config. The
FFmpeg core is served as static assets from `public/ffmpeg/` and cached immutably. If you
later add headers, keep `/ffmpeg/*` cacheable and avoid adding COOP/COEP unless you switch
to the threaded core.

## Testing

Unit tests cover the **pure, deterministic logic** — the parts that are worth testing
without a browser:

- `tests/validation.test.ts` — type/size/duration validation.
- `tests/profiles.test.ts` — preset resolution, "never upscale", FPS-cap rules.
- `tests/commands.test.ts` — FFmpeg argument assembly, filtergraph escaping, audio/no-audio
  branches, no shell metacharacter leakage.
- `tests/probe.test.ts` — FFmpeg log parsing, rotation/dimension swapping, no-audio case.
- `tests/errors.test.ts` — error-code mapping (memory, corrupt, cancel, browser).

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Browser-testing limitation

Vitest runs in Node and cannot exercise the FFmpeg.wasm worker, the Web Share API, or the
actual WASM encode. Those paths (loader, encode, output verification, cleanup, share) are
**not covered by automated tests here** — they require a real browser and real media. Manual
verification is recommended on desktop Chrome and Android Chrome before relying on a build.

## Browser support & limitations

- **Supported:** modern Chromium (Chrome/Edge), Firefox and Safari that support
  WebAssembly + Web Workers. Android Chrome is the primary target.
- The single-thread core avoids cross-origin isolation issues, so no special headers are
  needed.
- **Input limits:** ≤ 200 MB and ≤ 3 minutes (`lib/config.ts`). These are conservative
  because mobile RAM is limited.
- **One job at a time** to avoid exhausting device memory.
- **No persistence:** nothing is stored; the virtual filesystem and the worker are torn
  down when a job finishes or fails.
- **Never overwrites originals:** downloads use a new filename (`<name>-wa-<preset>.mp4`).
- Output is always H.264/AAC MP4 for maximum compatibility, even if the source was WebM/MKV.

## Performance & security

- All decoding/encoding happens **in the browser**; no media or metadata is sent anywhere.
- The engine runs in a **Web Worker**, so the UI never freezes.
- Progress updates are throttled (~4/s) to reduce re-render churn on low-end phones.
- FFmpeg arguments are built as a **structured array** and passed directly to `exec` — no
  shell string is ever constructed, so there is no command-injection surface.
- Input size, duration and concurrency are capped; clear errors are shown for memory,
  codec, browser and corrupt-file conditions.
- Object URLs are revoked and the worker is terminated on completion, cancellation and
  failure.

## A/B testing guide

There is no single "best" preset — the right choice depends on your content and WhatsApp's
current compression behaviour. Run your own comparison:

1. Pick a representative source clip (some motion, some fine detail, some text).
2. Optimize it once per preset (**Balanced**, **Maximum Quality**, **Small File**) and keep
   the originals.
3. Upload the **source** and each **optimized** file to WhatsApp Status **under identical
   conditions** (same test account, same network, close in time, same display device).
4. Export/save the posted result back from WhatsApp if possible, so you compare the
   **post-WhatsApp** versions, not the pre-upload files.
5. Compare across these axes:
   - **Sharpness / fine detail** (text, edges, foliage).
   - **Compression artefacts** (blocking, banding, smear in gradients/skies).
   - **Motion** (smoothness, ghosting, judder in fast pans).
   - **Audio** (loudness, clarity, sync).
   - **Final file size** and **processing time** on your device.
6. Record results in a small table and pick the preset that wins for *your* typical content.

Suggested result table:

| Source | Preset | Post-WA sharpness | Artefacts | Motion | Audio | Size | Process time |
| ------ | ------ | ----------------- | --------- | ------ | ----- | ---- | ------------ |
| clip1  | source | –                 | –         | –      | –     | …    | –            |
| clip1  | balanced | …               | …         | …      | …     | …    | …            |
| clip1  | maximum  | …               | …         | …      | …     | …    | …            |
| clip1  | small    | …               | …         | …      | …     | …    | …            |

## FAQ / troubleshooting

- **"Failed to load the video engine."** The FFmpeg core did not load. Confirm
  `public/ffmpeg/ffmpeg-core.js` and `.wasm` exist (run `npm run prepare:core`), and that
  your host serves `.wasm` with a `video/…`/`application/wasm`-friendly MIME type (Vercel
  does this automatically).
- **"Ran out of memory."** Try a shorter/smaller clip, or the Small File preset. Close
  other tabs on mobile.
- **Encoding is slow.** FFmpeg.wasm is CPU-bound and has no hardware acceleration. Expect
  slower-than-native times, especially for 1080p+ sources.
- **Output looks softer than the source.** Higher CRF (especially Small File) reduces
  detail; use Maximum Quality for the closest match.
- **SharedArrayBuffer / cross-origin errors.** You are likely running the threaded core or
  added COOP/COEP headers. This project intentionally uses the single-thread core.

---

## Development notes (Termux / Android)

If you develop on Termux (aarch64 Android), note that:

- Next.js has no native SWC binary for `android-arm64`, so `@next/swc-wasm-nodejs` is
  included as a devDependency to let `next build` run via the WASM fallback (slower, but
  functional). On Vercel/desktop the native SWC binary is used automatically.
- Termux's `#!/usr/bin/env node` shebang resolution can prevent `npm run <bin>` from
  finding local binaries. If that happens, invoke the tools directly, e.g.
  `node node_modules/typescript/bin/tsc --noEmit` or `node node_modules/vitest/vitest.mjs run`.
  Achieved results: **lint clean, typecheck clean, 40/40 unit tests passing, production
  build succeeding.**
