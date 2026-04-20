import { MONTH_NAMES } from "./mockData";
import type { WeekStartsOn } from "./types";

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatMonthYear(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function formatWeekRange(weekNumber: number, year: number): string {
  return `Week ${weekNumber} · ${year}`;
}

export function getProgressColor(progress: number): string {
  if (progress >= 80) return "#006c4a";
  if (progress >= 50) return "#005f41";
  return "#006c4a";
}

export function getPriorityColor(priority: string): {
  bg: string;
  text: string;
} {
  switch (priority) {
    case "high":
      return { bg: "bg-red-50", text: "text-red-600" };
    case "medium":
      return { bg: "bg-amber-50", text: "text-amber-600" };
    case "low":
      return { bg: "bg-slate-100", text: "text-slate-500" };
    default:
      return { bg: "bg-slate-100", text: "text-slate-500" };
  }
}

export function getTagColor(tag: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    Dev: { bg: "bg-blue-50", text: "text-blue-600" },
    Admin: { bg: "bg-purple-50", text: "text-purple-600" },
    Health: { bg: "bg-emerald-50", text: "text-emerald-700" },
    Growth: { bg: "bg-orange-50", text: "text-orange-600" },
    Personal: { bg: "bg-pink-50", text: "text-pink-600" },
    Errands: { bg: "bg-slate-100", text: "text-slate-600" },
    Finance: { bg: "bg-yellow-50", text: "text-yellow-700" },
  };
  return map[tag] ?? { bg: "bg-slate-100", text: "text-slate-500" };
}

const SUNDAY_DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONDAY_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function getDayLabels(weekStartsOn: WeekStartsOn): string[] {
  return weekStartsOn === "sunday" ? SUNDAY_DAY_LABELS : MONDAY_DAY_LABELS;
}

export function getWeekdayIndex(date: Date, weekStartsOn: WeekStartsOn): number {
  return weekStartsOn === "sunday" ? date.getDay() : (date.getDay() + 6) % 7;
}

export function formatWeekPreference(weekStartsOn: WeekStartsOn): string {
  return weekStartsOn === "sunday" ? "Sunday to Saturday" : "Monday to Sunday";
}

export function getTodayLabel(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}
