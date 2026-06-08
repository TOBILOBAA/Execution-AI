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
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div
          className="loading-spinner relative h-12 w-12 rounded-full"
          style={{
            background:
              "conic-gradient(from 180deg, rgba(0,108,74,0.08) 0deg, rgba(0,108,74,0.22) 110deg, #006c4a 260deg, rgba(0,108,74,0.08) 360deg)",
          }}
          aria-hidden="true"
        >
          <span className="absolute inset-[5px] rounded-full bg-[#f4f8f5]" />
        </div>
        <p className="text-xs font-semibold tracking-[0.03em] text-[--color-on-surface-variant]">
          {title}
        </p>
      </div>
    </div>
  );
}
