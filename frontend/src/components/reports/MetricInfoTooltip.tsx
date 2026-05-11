"use client";

export function MetricInfoTooltip({
  label,
  detail,
}: {
  label: string;
  detail: string;
}) {
  return (
    <span className="relative inline-flex shrink-0 self-start group">
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006c4a]/20"
        aria-label={`${label}: ${detail}`}
      >
        <span
          className="material-symbols-outlined block text-[15px] leading-none"
          style={{ color: "#a8b5af" }}
          aria-hidden="true"
        >
          info
        </span>
      </button>
      <span
        className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl px-3 py-2 text-left text-xs leading-relaxed opacity-0 shadow-lg transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 sm:w-64"
        style={{
          background: "#1f2a25",
          color: "#eef5f1",
          border: "1px solid rgba(255,255,255,0.08)",
          transform: "translateY(4px)",
        }}
        role="tooltip"
      >
        <strong className="block mb-1" style={{ color: "#ffffff" }}>
          {label}
        </strong>
        {detail}
      </span>
    </span>
  );
}
