"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SUNDAY_DAY_LABELS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MONDAY_DAY_LABELS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDisplayDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function formatShortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1];
  return `by ${monthShort} ${d}, ${y}`;
}

function getCalendarDays(year: number, month: number, weekStartsOn: "sunday" | "monday") {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const startOffset = weekStartsOn === "sunday" ? firstDay : (firstDay + 6) % 7;

  const days: { date: number; kind: "prev" | "cur" | "next" }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: daysInPrev - i, kind: "prev" });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: d, kind: "cur" });
  }
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: d, kind: "next" });
  }
  return days;
}

interface MiniCalendarProps {
  selectedDate: string; // ISO
  onSelect: (iso: string) => void;
}

export function MiniCalendar({ selectedDate, onSelect }: MiniCalendarProps) {
  const init = new Date(selectedDate);
  const [calYear, setCalYear] = useState(init.getFullYear());
  const [calMonth, setCalMonth] = useState(init.getMonth());
  const weekStartsOn = useAppStore((state) => state.sessionWeekStartsOn);
  const dayLabels = weekStartsOn === "sunday" ? SUNDAY_DAY_LABELS : MONDAY_DAY_LABELS;

  const calDays = getCalendarDays(calYear, calMonth, weekStartsOn);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  return (
    /* No overflow-hidden — avoids clipping descenders on digits like 9, g, p */
    <div className="rounded-xl border bg-white shadow-lg" style={{ borderColor: "#eaeeec" }}>
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-sm font-bold" style={{ color: "#1a1f1e" }}>
          {MONTHS[calMonth]} {calYear}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition"
            style={{ color: "#8a9e97" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#f4f6f4")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition"
            style={{ color: "#8a9e97" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#f4f6f4")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 px-3">
        {dayLabels.map((d) => (
          <div
            key={d}
            className="text-center py-1"
            style={{ fontSize: "10px", fontWeight: 700, color: "#b0bcb8", letterSpacing: "0.05em" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid — overflow-visible so descenders are never clipped */}
      <div className="grid grid-cols-7 px-3 pb-4" style={{ rowGap: "2px" }}>
        {calDays.map((day, i) => {
          const y =
            day.kind === "prev"
              ? calMonth === 0 ? calYear - 1 : calYear
              : day.kind === "next"
              ? calMonth === 11 ? calYear + 1 : calYear
              : calYear;
          const m =
            day.kind === "prev"
              ? calMonth === 0 ? 11 : calMonth - 1
              : day.kind === "next"
              ? calMonth === 11 ? 0 : calMonth + 1
              : calMonth;
          const iso = toISO(y, m, day.date);
          const isSelected = iso === selectedDate;
          const isCur = day.kind === "cur";

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                "w-8 h-8 mx-auto flex items-center justify-center rounded-full text-xs font-medium transition-colors"
              )}
              style={{
                background: isSelected ? "#006c4a" : "transparent",
                color: isSelected
                  ? "#ffffff"
                  : isCur
                  ? "#1a1f1e"
                  : "#c4d0cb",
                fontWeight: isSelected ? 700 : 500,
              }}
              onMouseEnter={e => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f0f3f1";
              }}
              onMouseLeave={e => {
                if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {day.date}
            </button>
          );
        })}
      </div>
    </div>
  );
}
