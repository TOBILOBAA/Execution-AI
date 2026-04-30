from __future__ import annotations

from datetime import date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from supabase import Client

import app.db.sessions as sessions_db
from app.core.exceptions import PeriodLockedError
from app.utils.date_utils import get_temporal_context, week_number_for


def _session_zone_name(db: Client, session_id: UUID) -> str:
    session = sessions_db.get_session(db, session_id)
    timezone_name = (session or {}).get("timezone") or "UTC"
    return str(timezone_name)


def _session_zone(db: Client, session_id: UUID) -> ZoneInfo:
    timezone_name = _session_zone_name(db, session_id)
    try:
        return ZoneInfo(timezone_name)
    except Exception:
        return ZoneInfo("UTC")


def get_session_today(db: Client, session_id: UUID) -> date:
    return datetime.now(_session_zone(db, session_id)).date()


def get_session_now(db: Client, session_id: UUID) -> datetime:
    return datetime.now(_session_zone(db, session_id))


def get_session_temporal_context(
    db: Client,
    session_id: UUID,
    reference_date: date | None = None,
):
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    today = reference_date or get_session_today(db, session_id)
    return get_temporal_context(reference_date=today, week_starts_on=week_starts_on)


def is_current_yearly_period(db: Client, session_id: UUID, year: int) -> bool:
    return year == get_session_today(db, session_id).year


def is_current_monthly_period(db: Client, session_id: UUID, year: int, month: int) -> bool:
    today = get_session_today(db, session_id)
    return (year, month) == (today.year, today.month)


def is_current_weekly_period(db: Client, session_id: UUID, year: int, week_number: int) -> bool:
    today = get_session_today(db, session_id)
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    return (year, week_number) == (today.year, week_number_for(today, week_starts_on))


def is_current_daily_period(db: Client, session_id: UUID, target_date: date) -> bool:
    return target_date == get_session_today(db, session_id)


def is_plannable_daily_period(db: Client, session_id: UUID, target_date: date) -> bool:
    today = get_session_today(db, session_id)
    return target_date == today or target_date == today.fromordinal(today.toordinal() + 1)


def assert_period_current_yearly(session_id: UUID, year: int, db: Client) -> None:
    if not is_current_yearly_period(db, session_id, year):
        raise PeriodLockedError()


def assert_period_current_monthly(session_id: UUID, year: int, month: int, db: Client) -> None:
    if not is_current_monthly_period(db, session_id, year, month):
        raise PeriodLockedError()


def assert_period_current_weekly(session_id: UUID, year: int, week_number: int, db: Client) -> None:
    if not is_current_weekly_period(db, session_id, year, week_number):
        raise PeriodLockedError()


def assert_period_current_daily(session_id: UUID, target_date: date, db: Client) -> None:
    if not is_current_daily_period(db, session_id, target_date):
        raise PeriodLockedError()


def assert_period_plannable_daily(session_id: UUID, target_date: date, db: Client) -> None:
    if not is_plannable_daily_period(db, session_id, target_date):
        raise PeriodLockedError()
