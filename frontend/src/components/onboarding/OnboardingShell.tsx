"use client";

import { cn } from "@/lib/utils";
import { SyncErrorBanner } from "@/components/SyncErrorBanner";

interface Step {
  num: number;
  label: string;
}

interface OnboardingShellProps {
  step: number;
  steps: Step[];
  onNext: () => void;
  onBack: () => void;
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
}

export function OnboardingShell({
  step,
  steps,
  children,
  rightPanel,
}: OnboardingShellProps) {
  return (
    <div className="min-h-screen flex bg-[#f4f6f4]">

      {/* ── Left Step Nav ── */}
      <aside className="hidden md:flex flex-col h-screen w-52 fixed left-0 top-0 bg-white border-r border-gray-100 py-8 px-5 z-20">
        {/* Brand */}
        <div className="mb-10">
          <h1 className="font-headline text-base font-extrabold tracking-tight text-[--color-primary]">
            Execution AI
          </h1>
        </div>

        {/* Step list */}
        <nav className="flex-1 space-y-0.5">
          {steps.map((s) => {
            const isActive = s.num === step;
            const isDone = s.num < step;
            return (
              <div
                key={s.num}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all duration-150 rounded-lg"
                )}
                style={
                  isActive
                    ? {
                        color: "#006c4a",
                        background: "rgba(0,108,74,0.07)",
                        borderLeft: "2.5px solid #006c4a",
                        paddingLeft: "10px",
                      }
                    : isDone
                    ? { color: "rgba(107,123,116,0.55)" }
                    : { color: "rgba(107,123,116,0.32)" }
                }
              >
                {s.num}. {s.label}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── Center Content ── */}
      <div className="flex-1 md:ml-52 md:mr-64 flex flex-col min-h-screen">
        {/* Progress bar header */}
        <header className="sticky top-0 z-10 bg-[#f4f6f4] pt-6 pb-4 px-10">
          <div className="flex items-center gap-2">
            {steps.map((s) => (
              <div
                key={s.num}
                className="flex-1 h-[3px] rounded-full transition-all duration-300"
                style={{ background: s.num <= step ? "#006c4a" : "#d1d8d4" }}
              />
            ))}
            <span className="ml-4 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap flex-shrink-0" style={{ color: "#6b7b74" }}>
              Step {step} of {steps.length}
            </span>
          </div>
        </header>

        <div className="px-10 shrink-0">
          <SyncErrorBanner />
        </div>

        {/* Step content */}
        <main className="flex-1 px-10 pt-8 pb-28">
          {children}
        </main>
      </div>

      {/* ── Right AI Guidance Panel ── */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed right-0 top-0 bg-white border-l border-gray-100 overflow-y-auto">
        {rightPanel}
      </aside>
    </div>
  );
}
