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
};

export function ReportMetricCard({
  label,
  value,
  subvalue,
  detail,
  helper,
  emphasized = false,
  tone = "white",
}: ReportMetricCardProps) {
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
      className="flex h-full min-h-[190px] flex-col rounded-[26px] p-5 md:p-6"
      style={{
        background,
        border,
        boxShadow: tone === "mint" ? "0 14px 34px rgba(0,108,74,0.08)" : "0 10px 28px rgba(15,23,42,0.04)",
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p
            className="text-[11px] font-bold uppercase leading-[1.15] tracking-[0.24em]"
            style={{ color: tone === "mint" ? "#5f7d73" : "#8ea19a" }}
          >
            {label}
          </p>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 4px 12px rgba(15,23,42,0.05)",
          }}
        >
          <MetricInfoTooltip label={label} detail={detail} />
        </div>
      </div>

      <div className="mt-6">
        <p
          className="font-headline font-extrabold tracking-tight"
          style={{
            color: "#1a1f1e",
            fontSize: emphasized ? "clamp(44px,5vw,56px)" : "clamp(32px,4vw,40px)",
            lineHeight: 0.94,
          }}
        >
          {value}
        </p>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: "#687a73" }}>
          {subvalue}
        </p>
      </div>

      <div className="mt-auto pt-5">
        {helper ? (
          <p
            className="inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-semibold leading-relaxed"
            style={{
              color: "#006c4a",
              background: "rgba(0,108,74,0.09)",
              border: "1px solid rgba(0,108,74,0.12)",
            }}
          >
            {helper}
          </p>
        ) : (
          <div className="h-[34px]" />
        )}
      </div>
    </article>
  );
}
