"use client";

import { useEffect, type ReactNode } from "react";
import type { ModalType } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  type: ModalType;
  data: unknown;
}

interface QuarterReportModalData {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  coveredMonths: string[];
  avgCompletion: number | null;
  topPillar: string | null;
  summary: string;
  reflection: string;
  nextFocus: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function formatDateLabel(dateIso: string) {
  const date = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateIso;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildArchiveLink(type: ModalType, data: unknown) {
  const details = asRecord(data);
  const explicitYear = asNumber(details.year);
  const explicitMonth = asNumber(details.month);
  const explicitDate = asString(details.date);
  const derivedYear = explicitYear ?? (explicitDate ? Number(explicitDate.slice(0, 4)) : null);

  switch (type) {
    case "monthly-report":
      if (explicitYear && explicitMonth) return `/dashboard/reports/${explicitYear}/${explicitMonth}`;
      return explicitYear ? `/dashboard/reports/${explicitYear}` : "/dashboard/reports";
    case "yearly-report":
      return explicitYear ? `/dashboard/reports/${explicitYear}` : "/dashboard/reports";
    case "weekly-report":
      return derivedYear ? `/dashboard/reports/${derivedYear}` : "/dashboard/reports";
    case "daily-report":
      return derivedYear ? `/dashboard/reports/${derivedYear}` : "/dashboard/reports";
    default:
      return "/dashboard/reports";
  }
}

function buildLegacyReportCopy(type: ModalType, data: unknown) {
  const details = asRecord(data);
  const year = asNumber(details.year);
  const month = asNumber(details.month);
  const week = asNumber(details.week);
  const date = asString(details.date);

  if (type === "daily-report") {
    return {
      eyebrow: "Daily report",
      title: date ? formatDateLabel(date) : "Saved daily reflection",
      detail:
        "Daily reflections are generated in the end-of-day flow and stored in the yearly reports archive. This legacy modal no longer renders a separate fake recap screen.",
      cta: "Open reports archive",
    };
  }

  if (type === "weekly-report") {
    return {
      eyebrow: "Weekly report",
      title: year && week ? `Week ${week}, ${year}` : "Saved weekly review",
      detail:
        "Weekly reviews belong in the reports archive and the review prompt flow. This fallback keeps the route truthful instead of showing demo-only summary content.",
      cta: "Open yearly archive",
    };
  }

  if (type === "monthly-report") {
    const title =
      year && month
        ? new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })
        : "Saved monthly review";
    return {
      eyebrow: "Monthly report",
      title,
      detail:
        "Monthly reviews now live in the reports archive, where they can show saved metrics, generated reflections, and linked weekly evidence from that month.",
      cta: "Open monthly archive",
    };
  }

  return {
    eyebrow: "Yearly report",
    title: year ? `${year} execution report` : "Yearly execution report",
    detail:
      "Yearly reviews now live on the full archive page instead of a standalone summary modal, so the user always sees the real metrics, saved narrative, and linked period evidence together.",
    cta: "Open yearly archive",
  };
}

function ModalShell({
  onClose,
  children,
  wide = false,
  labelledBy,
}: {
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  labelledBy?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-6"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="flex w-full max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl overscroll-contain sm:max-h-[calc(100dvh-3rem)]"
        style={{ maxWidth: wide ? 720 : 560 }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ArchiveFallbackModal({ onClose, type, data }: { onClose: () => void; type: ModalType; data: unknown }) {
  const copy = buildLegacyReportCopy(type, data);
  const href = buildArchiveLink(type, data);

  return (
    <ModalShell onClose={onClose} labelledBy="legacy-report-title">
      <div className="flex min-h-0 flex-col">
        <div className="flex items-start justify-between px-4 pb-5 pt-5 sm:px-6 sm:pt-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
              {copy.eyebrow}
            </p>
            <h2 id="legacy-report-title" className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>
              {copy.title}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl transition-opacity hover:opacity-60" style={{ color: "#a8b5af" }}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6 space-y-4">
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(0,108,74,0.06)", border: "1.5px solid rgba(0,108,74,0.14)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#006c4a" }}>
              Archive-first view
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#4a5c54" }}>
              {copy.detail}
            </p>
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.07)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8a9e97" }}>
              Why this changed
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#4a5c54" }}>
              The product now prefers archive pages and review flows that are backed by saved report records. That keeps report metrics, summaries, and period context consistent instead of splitting them across old modal-only layouts.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:px-6" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm font-bold transition-opacity hover:opacity-70"
            style={{ border: "1.5px solid rgba(0,0,0,0.1)", color: "#6b7c75" }}
          >
            Close
          </button>
          <a
            href={href}
            className="flex-1 py-3 rounded-2xl text-sm font-bold text-white text-center transition-opacity hover:opacity-80"
            style={{ background: "#006c4a" }}
          >
            {copy.cta}
          </a>
        </div>
      </div>
    </ModalShell>
  );
}

function QuarterlyReportModal({ onClose, data }: { onClose: () => void; data: unknown }) {
  const details = (data ?? {}) as QuarterReportModalData;
  const coveredMonths = details.coveredMonths?.length ? details.coveredMonths.join(", ") : "No monthly reports saved yet";

  return (
    <ModalShell onClose={onClose} wide labelledBy="quarterly-report-title">
      <div className="flex min-h-0 flex-col">
        <div className="flex items-start justify-between px-4 pb-5 pt-5 sm:px-6 sm:pt-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
              Quarterly review
            </p>
            <h2 id="quarterly-report-title" className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>
              Q{details.quarter ?? 1} {details.year ?? new Date().getFullYear()}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "#8a9e97" }}>
              Built from saved monthly reports across {coveredMonths}.
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl transition-opacity hover:opacity-60" style={{ color: "#a8b5af" }}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="rounded-2xl p-5 mb-5 flex gap-3" style={{ background: "rgba(0,108,74,0.06)", border: "1.5px solid rgba(0,108,74,0.15)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#006c4a" }}>
              <span className="material-symbols-outlined text-[18px] text-white">summarize</span>
            </div>
            <div>
              <p className="text-sm font-bold mb-2" style={{ color: "#1a1f1e" }}>Saved quarterly summary</p>
              <p className="text-sm leading-relaxed" style={{ color: "#4a5c54" }}>
                {details.summary || "Monthly reports exist in this quarter, but the saved summary is not available yet."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <div className="rounded-2xl p-4" style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>Average completion</p>
              <p className="font-headline font-extrabold text-3xl" style={{ color: "#1a1f1e" }}>
                {details.avgCompletion === null ? "—" : `${details.avgCompletion}%`}
              </p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>Top pillar</p>
              <p className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>
                {details.topPillar || "Not identified yet"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-4 mb-5" style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.07)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>Reflection</p>
            <p className="text-sm leading-relaxed" style={{ color: "#4a5c54" }}>
              {details.reflection || "The quarter reflection is waiting on stronger monthly reporting depth."}
            </p>
          </div>

          {details.nextFocus ? (
            <div className="rounded-2xl p-4" style={{ background: "rgba(0,108,74,0.06)", border: "1.5px solid rgba(0,108,74,0.12)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#006c4a" }}>Next focus</p>
              <p className="text-sm font-semibold leading-relaxed" style={{ color: "#1a1f1e" }}>
                {details.nextFocus}
              </p>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t px-4 py-4 sm:px-6" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-80" style={{ background: "#006c4a" }}>
            Close quarterly review
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function ReportModal({ open, onClose, type, data }: Props) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  if (type === "quarterly-report") {
    return <QuarterlyReportModal onClose={onClose} data={data} />;
  }

  return <ArchiveFallbackModal onClose={onClose} type={type} data={data} />;
}
