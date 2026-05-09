"use client";

import { MetricInfoTooltip } from "@/components/reports/MetricInfoTooltip";

type ReportMetricCardProps = {
  label: string;
  value: string;
  subvalue: string;
  detail: string;
  helper?: string;
  emphasized?: boolean;
  tone?: "mint" | "white";
  density?: "regular" | "compact";
};

export function ReportMetricCard({
  label,
  value,
  subvalue,
  detail,
  helper,
  emphasized = false,
  tone = "white",
  density = "regular",
}: ReportMetricCardProps) {
  const compact = density === "compact";
  const background =
    tone === "mint"
      ? "linear-gradient(180deg, rgba(0,108,74,0.09), rgba(0,108,74,0.03))"
      : "#ffffff";
  const border =
    tone === "mint"
      ? "1.5px solid rgba(0,108,74,0.12)"
      : "1.5px solid rgba(0,0,0,0.07)";

  return (
    <article
      className={`flex h-full flex-col rounded-[26px] ${compact ? "min-h-[168px] p-4 md:p-5" : "min-h-[190px] p-5 md:p-6"}`}
      style={{
        background,
        border,
        boxShadow: tone === "mint" ? "0 14px 34px rgba(0,108,74,0.08)" : "0 10px 28px rgba(15,23,42,0.04)",
      }}
    >
      <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-start ${compact ? "gap-2.5" : "gap-3"}`}>
        <div className="min-w-0">
          <p
            className={`font-bold uppercase leading-[1.15] ${compact ? "text-[10px] tracking-[0.22em]" : "text-[11px] tracking-[0.24em]"}`}
            style={{ color: tone === "mint" ? "#5f7d73" : "#8ea19a" }}
          >
            {label}
          </p>
        </div>
        <div
          className={`flex items-center justify-center rounded-full ${compact ? "h-8 w-8" : "h-9 w-9"}`}
          style={{
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 4px 12px rgba(15,23,42,0.05)",
          }}
        >
          <MetricInfoTooltip label={label} detail={detail} />
        </div>
      </div>

      <div className={compact ? "mt-5" : "mt-6"}>
        <p
          className="font-headline font-extrabold tracking-tight"
          style={{
            color: "#1a1f1e",
            fontSize: emphasized
              ? compact
                ? "clamp(38px,4vw,48px)"
                : "clamp(44px,5vw,56px)"
              : compact
                ? "clamp(28px,3vw,34px)"
                : "clamp(32px,4vw,40px)",
            lineHeight: 0.94,
          }}
        >
          {value}
        </p>
        <p className={`${compact ? "mt-3 text-[13px]" : "mt-4 text-sm"} leading-relaxed`} style={{ color: "#687a73" }}>
          {subvalue}
        </p>
      </div>

      <div className={`mt-auto ${compact ? "pt-4" : "pt-5"}`}>
        {helper ? (
          <p
            className={`inline-flex max-w-full items-center rounded-full font-semibold leading-relaxed ${compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
            style={{
              color: "#006c4a",
              background: "rgba(0,108,74,0.09)",
              border: "1px solid rgba(0,108,74,0.12)",
            }}
          >
            {helper}
          </p>
        ) : (
          <div className={compact ? "h-[28px]" : "h-[34px]"} />
        )}
      </div>
    </article>
  );
}
