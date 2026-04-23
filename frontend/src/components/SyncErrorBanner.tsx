"use client";

import { useAppStore } from "@/lib/store";

function bannerMeta(syncError: string): { title: string; footer: string } {
  const isAiOrLoad =
    syncError.includes("(AI generate)") ||
    syncError.startsWith("Load ") ||
    syncError.startsWith("Monthly plan (AI") ||
    syncError.startsWith("Weekly plan (AI") ||
    syncError.startsWith("Daily plan (AI");
  if (isAiOrLoad) {
    return {
      title: "Server request failed",
      footer:
        "This call did not finish successfully. Check NEXT_PUBLIC_API_URL, network, and backend status, then retry. Data in this browser may still be cached locally until sync succeeds.",
    };
  }
  return {
    title: "Could not save to server",
    footer:
      "Goals and onboarding may still be cached in this browser until the request above succeeds. Fix the API or URL (NEXT_PUBLIC_API_URL), then retry.",
  };
}

/** Shows backend / sync failures so users are not misled when local UI looks saved. */
export function SyncErrorBanner() {
  const syncError = useAppStore((s) => s.syncError);
  const clearSyncError = useAppStore((s) => s.clearSyncError);

  if (!syncError) return null;

  const { title, footer } = bannerMeta(syncError);

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl mx-4 md:mx-0 mb-3"
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.22)",
      }}
      role="alert"
    >
      <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5" style={{ color: "#dc2626" }}>
        cloud_off
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#b91c1c" }}>
          {title}
        </p>
        <p className="text-xs leading-relaxed break-words" style={{ color: "#7f1d1d" }}>
          {syncError}
        </p>
        <p className="text-[11px] mt-1.5" style={{ color: "#991b1b" }}>
          {footer}
        </p>
      </div>
      <button
        type="button"
        onClick={clearSyncError}
        className="flex-shrink-0 p-1 rounded-lg transition-opacity hover:opacity-70"
        style={{ color: "#991b1b" }}
        aria-label="Dismiss error"
      >
        <span className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  );
}
