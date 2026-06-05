"use client";

type BetaBadgeProps = {
  compact?: boolean;
  light?: boolean;
  className?: string;
};

export function BetaBadge({ compact = false, light = false, className = "" }: BetaBadgeProps) {
  const padding = compact ? "px-2 py-1" : "px-2.5 py-1";
  const textSize = compact ? "text-[9px]" : "text-[10px]";
  const colors = light
    ? {
        background: "rgba(133,248,196,0.12)",
        border: "1px solid rgba(133,248,196,0.24)",
        color: "#85f8c4",
      }
    : {
        background: "rgba(0,108,74,0.08)",
        border: "1px solid rgba(0,108,74,0.14)",
        color: "#006c4a",
      };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.18em] ${padding} ${textSize} ${className}`.trim()}
      style={colors}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: colors.color }}
      />
      Beta
    </span>
  );
}
