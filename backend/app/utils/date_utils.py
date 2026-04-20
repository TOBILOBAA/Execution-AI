"""
Deterministic date/time utilities.

All date math lives here — never in the AI layer.
The AI layer receives compact temporal context computed here.
"""
import calendar
from datetime import date, datetime, timedelta
from dataclasses import dataclass
from typing import Literal


WeekStartsOn = Literal["sunday", "monday"]


SUNDAY_FIRST_TIMEZONE_PREFIXES = (
    "America/",
)

SUNDAY_FIRST_TIMEZONES = {
    "Asia/Jerusalem",
}


@dataclass(frozen=True)
class TemporalContext:
    """
    A snapshot of all time-related facts the planning layer needs.
    Constructed once per request and passed down cleanly.
    """
    today: date
    week_starts_on: WeekStartsOn
    current_year: int
    current_month: int           # 1-12
    current_week_number: int     # Week number within the calendar year for the configured week model
    week_start: date             # Start day of current week
    week_end: date               # End day of current week
    days_in_month: int
    day_of_month: int            # 1-based
    days_remaining_in_month: int # including today
    days_remaining_in_week: int  # including today
    month_progress_pct: int      # 0-100
    week_progress_pct: int       # 0-100
    is_late_in_month: bool       # days_remaining <= 7
    is_late_in_week: bool        # days_remaining_in_week <= 2


def normalize_week_starts_on(raw: str | None) -> WeekStartsOn:
    value = (raw or "").strip().lower()
    if value == "sunday":
        return "sunday"
    return "monday"


def infer_week_starts_on(timezone_name: str | None) -> WeekStartsOn:
    tz = (timezone_name or "").strip()
    if tz in SUNDAY_FIRST_TIMEZONES:
        return "sunday"
    if any(tz.startswith(prefix) for prefix in SUNDAY_FIRST_TIMEZONE_PREFIXES):
        return "sunday"
    return "monday"


def resolve_week_starts_on(
    raw: str | None,
    timezone_name: str | None = None,
) -> WeekStartsOn:
    if raw is not None and str(raw).strip():
        return normalize_week_starts_on(raw)
    return infer_week_starts_on(timezone_name)


def week_start_for(ref: date, week_starts_on: WeekStartsOn = "monday") -> date:
    """Return the date that starts the planning week containing `ref`."""
    if week_starts_on == "sunday":
        days_since_start = (ref.weekday() + 1) % 7
    else:
        days_since_start = ref.weekday()
    return ref - timedelta(days=days_since_start)


def week_end_for(ref: date, week_starts_on: WeekStartsOn = "monday") -> date:
    return week_start_for(ref, week_starts_on) + timedelta(days=6)


def week_number_for(ref: date, week_starts_on: WeekStartsOn = "monday") -> int:
    """
    Return the planning week number for the calendar year of `ref`.

    Week 1 starts on the configured week-start day on or before January 1st.
    """
    week1_start = week_start_for(date(ref.year, 1, 1), week_starts_on)
    return ((week_start_for(ref, week_starts_on) - week1_start).days // 7) + 1


def sunday_week_start(ref: date) -> date:
    """Backward-compatible Sunday-start helper."""
    return week_start_for(ref, "sunday")


def sunday_week_number(ref: date) -> int:
    """Backward-compatible Sunday-start helper."""
    return week_number_for(ref, "sunday")


def get_temporal_context(
    reference_date: date | None = None,
    week_starts_on: WeekStartsOn = "monday",
) -> TemporalContext:
    today = reference_date or date.today()
    resolved_week_starts_on = normalize_week_starts_on(week_starts_on)

    week_number = week_number_for(today, resolved_week_starts_on)
    week_start = week_start_for(today, resolved_week_starts_on)
    week_end = week_start + timedelta(days=6)
    if resolved_week_starts_on == "sunday":
        day_index = (today.weekday() + 1) % 7  # Sunday=0 ... Saturday=6
    else:
        day_index = today.weekday()            # Monday=0 ... Sunday=6

    days_in_month = calendar.monthrange(today.year, today.month)[1]
    days_remaining_in_month = days_in_month - today.day + 1
    days_remaining_in_week = 7 - day_index

    month_progress_pct = int(
        ((today.day - 1) / days_in_month) * 100
    )
    week_progress_pct = int((day_index / 7) * 100)

    return TemporalContext(
        today=today,
        week_starts_on=resolved_week_starts_on,
        current_year=today.year,
        current_month=today.month,
        current_week_number=week_number,
        week_start=week_start,
        week_end=week_end,
        days_in_month=days_in_month,
        day_of_month=today.day,
        days_remaining_in_month=days_remaining_in_month,
        days_remaining_in_week=days_remaining_in_week,
        month_progress_pct=month_progress_pct,
        week_progress_pct=week_progress_pct,
        is_late_in_month=days_remaining_in_month <= 7,
        is_late_in_week=days_remaining_in_week <= 2,
    )


def get_week_boundaries(
    year: int,
    week_number: int,
    week_starts_on: WeekStartsOn = "monday",
) -> tuple[date, date]:
    """Return the configured week boundaries for the given planning week."""
    week1_start = week_start_for(date(year, 1, 1), normalize_week_starts_on(week_starts_on))
    week_start = week1_start + timedelta(weeks=week_number - 1)
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def days_remaining_in_week_from(ref: date, week_starts_on: WeekStartsOn = "monday") -> int:
    """How many days remain in the configured planning week that contains `ref` (including ref)."""
    if normalize_week_starts_on(week_starts_on) == "sunday":
        day_index = (ref.weekday() + 1) % 7
    else:
        day_index = ref.weekday()
    return 7 - day_index


def days_remaining_in_month_from(ref: date) -> int:
    days_in_month = calendar.monthrange(ref.year, ref.month)[1]
    return days_in_month - ref.day + 1


def is_current_week(
    year: int,
    week_number: int,
    ref: date | None = None,
    week_starts_on: WeekStartsOn = "monday",
) -> bool:
    today = ref or date.today()
    return week_number == week_number_for(today, week_starts_on) and year == today.year


def is_current_month(year: int, month: int, ref: date | None = None) -> bool:
    today = ref or date.today()
    return month == today.month and year == today.year


def is_past_date(d: date, ref: date | None = None) -> bool:
    today = ref or date.today()
    return d < today


def is_past_month(year: int, month: int, ref: date | None = None) -> bool:
    today = ref or date.today()
    return (year, month) < (today.year, today.month)


def is_past_week(
    year: int,
    week_number: int,
    ref: date | None = None,
    week_starts_on: WeekStartsOn = "monday",
) -> bool:
    today = ref or date.today()
    return (year, week_number) < (today.year, week_number_for(today, week_starts_on))


def compute_execution_streak(completion_dates: list[date]) -> int:
    """
    Given a list of dates on which the user completed something,
    compute how many consecutive days ending today (or yesterday).
    """
    if not completion_dates:
        return 0
    unique_dates = sorted(set(completion_dates), reverse=True)
    today = date.today()
    streak = 0
    expected = today
    for d in unique_dates:
        if d == expected or d == expected - timedelta(days=1) and streak == 0:
            streak += 1
            expected = d - timedelta(days=1)
        elif d == expected:
            streak += 1
            expected = d - timedelta(days=1)
        else:
            break
    return streak


def week_date_range_label(week_start: date, week_end: date) -> str:
    if week_start.month == week_end.month:
        return f"{week_start.strftime('%b')} {week_start.day}–{week_end.day}"
    return f"{week_start.strftime('%b')} {week_start.day} – {week_end.strftime('%b')} {week_end.day}"


def month_name(month: int) -> str:
    return calendar.month_name[month]


def compact_temporal_summary(ctx: TemporalContext) -> dict:
    """
    Compact dict injected into AI prompts. Keeps prompts short and precise.
    """
    return {
        "today": ctx.today.isoformat(),
        "day_of_week": ctx.today.strftime("%A"),
        "month": month_name(ctx.current_month),
        "year": ctx.current_year,
        "week_number": ctx.current_week_number,
        "days_remaining_in_month": ctx.days_remaining_in_month,
        "days_remaining_in_week": ctx.days_remaining_in_week,
        "month_progress_pct": ctx.month_progress_pct,
        "week_progress_pct": ctx.week_progress_pct,
        "is_late_in_month": ctx.is_late_in_month,
        "is_late_in_week": ctx.is_late_in_week,
    }
