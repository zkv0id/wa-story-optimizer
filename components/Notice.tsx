"use client";

interface NoticeProps {
  tone?: "info" | "warning" | "error";
  title?: string;
  children: React.ReactNode;
}

const TONES = {
  info: "border-emerald-500/20 bg-emerald-500/5 text-emerald-200/90",
  warning: "border-amber-500/25 bg-amber-500/5 text-amber-200/90",
  error: "border-red-500/25 bg-red-500/5 text-red-200/90",
};

export function Notice({ tone = "info", title, children }: NoticeProps) {
  return (
    <div className={`rounded-xl border p-3 text-xs leading-relaxed ${TONES[tone]}`} role="note">
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function ErrorBanner({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-xs text-red-200/90" role="alert">
      <p className="font-semibold">{message}</p>
      {detail ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-red-300/80">Technical details</summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-red-200/70">
            {detail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
