"use client";

import { cn } from "@/lib/utils";

interface AppLoadingScreenProps {
  title?: string;
  fullscreen?: boolean;
}

export function AppLoadingScreen({
  title = "Loading",
  fullscreen = true,
}: AppLoadingScreenProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden",
        fullscreen ? "min-h-screen flex items-center justify-center px-6 py-10" : "rounded-[28px] px-6 py-8",
      )}
      style={{
        background:
          "radial-gradient(circle at top, rgba(133,248,196,0.22), transparent 34%), linear-gradient(180deg, #f4f8f5 0%, #eef5f0 100%)",
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative w-full max-w-sm rounded-[32px] border border-white/70 bg-white/78 px-8 py-10 text-center shadow-[0_24px_80px_rgba(0,108,74,0.08)] backdrop-blur-xl sm:px-10 sm:py-12">
        <div className="mx-auto flex w-full justify-center">
          <div className="loading-iteration relative h-20 w-20" aria-hidden="true">
            <span className="absolute inset-0 rounded-full border border-[rgba(0,108,74,0.10)]" />
            <span className="absolute inset-[8px] rounded-full border border-[rgba(0,108,74,0.18)]" />
            <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[--color-primary]" />
            <span className="loading-iteration-dot absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-[--color-primary]" />
            <span className="loading-iteration-dot-delayed absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[rgba(0,108,74,0.48)]" />
          </div>
        </div>

        <p className="mt-6 text-sm font-semibold tracking-[0.02em] text-[--color-on-surface-variant]">
          {title}
        </p>
      </div>
    </div>
  );
}
