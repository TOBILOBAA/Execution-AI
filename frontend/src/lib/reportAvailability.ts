import type { WeekStartsOn } from "./types";

function startOfLocalDay(from: Date): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
}

/** First instant of the local calendar day after `from`'s date (midnight). */
export function startOfNextLocalCalendarDay(from: Date): Date {
  const t = startOfLocalDay(from);
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 0, 0, 0, 0);
}

/**
 * Day recap becomes available in the evening once the user has had most of the
 * day to execute. This aligns with the 18:00 review cadence in the product.
 */
export function isDayRecapPeriodComplete(now: Date): boolean {
  return now.getHours() >= 18;
}

/** Start of the configured local week containing `from`. */
export function startOfLocalWeek(from: Date, weekStartsOn: WeekStartsOn): Date {
  const x = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
  const offset = weekStartsOn === "sunday" ? x.getDay() : (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - offset);
  return x;
}

/** End of the configured planning week that contains `from`. */
export function endOfLocalWeek(from: Date, weekStartsOn: WeekStartsOn): Date {
  const start = startOfLocalWeek(from, weekStartsOn);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
}

/**
 * Weekly recap opens late on the final day of the configured week and stays
 * available through the first day of the next one.
 */
export function isWeekRecapPeriodComplete(now: Date, weekStartsOn: WeekStartsOn): boolean {
  const day = now.getDay();
  if (weekStartsOn === "sunday") {
    return day === 0 || (day === 6 && now.getHours() >= 18);
  }
  return day === 1 || (day === 0 && now.getHours() >= 18);
}
