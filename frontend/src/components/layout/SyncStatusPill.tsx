"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

type VisibleState = "hidden" | "saving" | "saved" | "failed";

const STATUS_META: Record<Exclude<VisibleState, "hidden">, { icon: string; label: string; className: string }> = {
  saving: {
    icon: "sync",
    label: "Saving changes",
    className: "border-[rgba(0,108,74,0.12)] bg-[rgba(0,108,74,0.07)] text-[--color-primary]",
  },
  saved: {
    icon: "cloud_done",
    label: "All changes saved",
    className: "border-[rgba(15,118,110,0.12)] bg-[rgba(15,118,110,0.08)] text-[#0f766e]",
  },
  failed: {
    icon: "cloud_off",
    label: "Save issue",
    className: "border-[rgba(220,38,38,0.14)] bg-[rgba(220,38,38,0.08)] text-[#b91c1c]",
  },
};

export function SyncStatusPill() {
  const syncStatus = useAppStore((state) => state.syncStatus);
  const [visibleState, setVisibleState] = useState<VisibleState>("hidden");

  useEffect(() => {
    if (syncStatus === "saving" || syncStatus === "failed") {
      setVisibleState(syncStatus);
      return;
    }
    if (syncStatus === "saved") {
      setVisibleState("saved");
      const timeout = window.setTimeout(() => setVisibleState("hidden"), 1800);
      return () => window.clearTimeout(timeout);
    }
    setVisibleState("hidden");
  }, [syncStatus]);

  if (visibleState === "hidden") return null;

  const meta = STATUS_META[visibleState];

  return (
    <div
      className={`hidden min-[920px]:inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold tracking-[0.08em] uppercase transition-all duration-200 ${meta.className}`}
      role="status"
      aria-live="polite"
    >
      <span
        className={`material-symbols-outlined text-[15px] ${visibleState === "saving" ? "animate-spin" : ""}`}
        aria-hidden="true"
      >
        {meta.icon}
      </span>
      <span>{meta.label}</span>
    </div>
  );
}
