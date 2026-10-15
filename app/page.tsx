import { OptimizerApp } from "@/components/OptimizerApp";

export default function Page() {
  return (
    <main className="min-h-dvh">
      <OptimizerApp />
      <footer className="mx-auto max-w-5xl px-4 pb-10 text-center text-[11px] text-gray-600 sm:px-6">
        Runs fully client-side with FFmpeg.wasm · No backend, no tracking, no uploads.
      </footer>
    </main>
  );
}
