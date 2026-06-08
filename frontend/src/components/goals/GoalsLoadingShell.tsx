"use client";

interface Props {
  eyebrow?: string;
  title?: string;
  detail?: string;
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`skeleton-wave rounded-2xl ${className}`}
      style={{ background: "linear-gradient(90deg, rgba(232,238,235,0.8), rgba(244,249,247,1), rgba(232,238,235,0.8))" }}
    />
  );
}

export function GoalsLoadingShell({
  eyebrow = "Syncing goals",
  title = "Pulling the latest planning layers",
  detail = "We are checking yearly, monthly, weekly, and daily links from the server before rendering this page.",
}: Props) {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto w-full" role="status" aria-live="polite" aria-busy="true">
      <div
        className="rounded-[28px] p-6 md:p-8"
        style={{
          background: "linear-gradient(180deg, rgba(250,252,251,1), rgba(244,249,247,1))",
          border: "1.5px solid rgba(0,0,0,0.06)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="status-dot" aria-hidden="true" />
          <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "#8a9e97" }}>
            {eyebrow}
          </p>
        </div>
        <h1 className="mt-2 font-headline font-extrabold tracking-tight" style={{ fontSize: "30px", color: "#1a1f1e" }}>
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
          {detail}
        </p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[rgba(0,108,74,0.08)]">
          <div className="loading-sheen h-full w-1/3 rounded-full bg-[linear-gradient(90deg,#006c4a_0%,#2e8f6b_100%)]" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-8">
          <div className="xl:col-span-8 space-y-5">
            <SkeletonBlock className="h-36 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonBlock className="h-40 w-full" />
              <SkeletonBlock className="h-40 w-full" />
              <SkeletonBlock className="h-40 w-full" />
              <SkeletonBlock className="h-40 w-full" />
            </div>
            <SkeletonBlock className="h-56 w-full" />
          </div>
          <div className="xl:col-span-4 space-y-5">
            <SkeletonBlock className="h-44 w-full" />
            <SkeletonBlock className="h-56 w-full" />
            <SkeletonBlock className="h-48 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
