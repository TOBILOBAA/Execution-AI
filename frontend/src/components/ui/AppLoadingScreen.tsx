"use client";

import { cn } from "@/lib/utils";

interface AppLoadingScreenProps {
  eyebrow?: string;
  title?: string;
  detail?: string;
  fullscreen?: boolean;
}

export function AppLoadingScreen({
  eyebrow = "Preparing your workspace",
  title = "Getting Execution AI ready",
  detail = "We are connecting your account, syncing your plans, and opening the next screen.",
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
      <div className="relative w-full max-w-lg rounded-[32px] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(0,108,74,0.10)] backdrop-blur-xl sm:p-10">
        <div className="flex items-center gap-3">
          <div className="loading-orbit flex h-14 w-14 items-center justify-center rounded-[20px] bg-[rgba(0,108,74,0.12)] text-[--color-primary]">
            <span className="material-symbols-outlined text-[26px]">bolt</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[--color-primary]">
              {eyebrow}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="status-dot" aria-hidden="true" />
              <span className="text-xs font-semibold text-[--color-on-surface-variant]">
                Live sync in progress
              </span>
            </div>
          </div>
        </div>

        <div className="mt-7 space-y-3">
          <h1 className="font-headline text-[28px] font-extrabold tracking-tight text-[--color-on-surface] sm:text-[32px]">
            {title}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-[--color-on-surface-variant]">
            {detail}
          </p>
        </div>

        <div className="mt-7 h-2 overflow-hidden rounded-full bg-[rgba(0,108,74,0.10)]">
          <div className="loading-sheen h-full w-2/5 rounded-full bg-[linear-gradient(90deg,#006c4a_0%,#2e8f6b_100%)]" />
        </div>
      </div>
    </div>
  );
}
