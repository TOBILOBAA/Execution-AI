import unittest
from datetime import date
from uuid import uuid4
from unittest.mock import patch

from app.core.exceptions import PeriodLockedError
from app.utils import period_guards


class PeriodGuardTests(unittest.TestCase):
    def test_plannable_yearly_allows_current_and_next_year(self):
        session_id = uuid4()
        with patch.object(period_guards, "get_session_today", return_value=date(2026, 4, 30)):
            period_guards.assert_period_plannable_yearly(session_id, 2026, object())
            period_guards.assert_period_plannable_yearly(session_id, 2027, object())

    def test_plannable_yearly_rejects_later_year(self):
        session_id = uuid4()
        with patch.object(period_guards, "get_session_today", return_value=date(2026, 4, 30)):
            with self.assertRaises(PeriodLockedError):
                period_guards.assert_period_plannable_yearly(session_id, 2028, object())

    def test_plannable_monthly_allows_current_and_next_month(self):
        session_id = uuid4()
        with patch.object(period_guards, "get_session_today", return_value=date(2026, 4, 30)):
            period_guards.assert_period_plannable_monthly(session_id, 2026, 4, object())
            period_guards.assert_period_plannable_monthly(session_id, 2026, 5, object())

    def test_plannable_monthly_rejects_later_month(self):
        session_id = uuid4()
        with patch.object(period_guards, "get_session_today", return_value=date(2026, 4, 30)):
            with self.assertRaises(PeriodLockedError):
                period_guards.assert_period_plannable_monthly(session_id, 2026, 6, object())

    def test_plannable_monthly_handles_year_rollover(self):
        session_id = uuid4()
        with patch.object(period_guards, "get_session_today", return_value=date(2026, 12, 15)):
            period_guards.assert_period_plannable_monthly(session_id, 2026, 12, object())
            period_guards.assert_period_plannable_monthly(session_id, 2027, 1, object())

    def test_plannable_weekly_allows_current_and_next_week(self):
        session_id = uuid4()
        db = object()
        with patch.object(period_guards, "get_session_today", return_value=date(2026, 4, 30)):
            with patch.object(period_guards.sessions_db, "get_effective_week_starts_on", return_value="monday"):
                period_guards.assert_period_plannable_weekly(session_id, 2026, 18, db)
                period_guards.assert_period_plannable_weekly(session_id, 2026, 19, db)

    def test_plannable_weekly_rejects_later_week(self):
        session_id = uuid4()
        db = object()
        with patch.object(period_guards, "get_session_today", return_value=date(2026, 4, 30)):
            with patch.object(period_guards.sessions_db, "get_effective_week_starts_on", return_value="monday"):
                with self.assertRaises(PeriodLockedError):
                    period_guards.assert_period_plannable_weekly(session_id, 2026, 20, db)

    def test_plannable_weekly_handles_year_rollover(self):
        session_id = uuid4()
        db = object()
        with patch.object(period_guards, "get_session_today", return_value=date(2026, 12, 31)):
            with patch.object(period_guards.sessions_db, "get_effective_week_starts_on", return_value="monday"):
                current_week = period_guards.week_number_for(date(2026, 12, 31), "monday")
                next_week = period_guards.week_number_for(date(2027, 1, 7), "monday")
                period_guards.assert_period_plannable_weekly(session_id, 2026, current_week, db)
                period_guards.assert_period_plannable_weekly(session_id, 2027, next_week, db)

    def test_plannable_daily_allows_today(self):
        session_id = uuid4()
        with patch.object(period_guards, "get_session_today", return_value=date(2026, 4, 30)):
            period_guards.assert_period_plannable_daily(session_id, date(2026, 4, 30), object())

    def test_plannable_daily_allows_tomorrow(self):
        session_id = uuid4()
        with patch.object(period_guards, "get_session_today", return_value=date(2026, 4, 30)):
            period_guards.assert_period_plannable_daily(session_id, date(2026, 5, 1), object())

    def test_plannable_daily_rejects_other_dates(self):
        session_id = uuid4()
        with patch.object(period_guards, "get_session_today", return_value=date(2026, 4, 30)):
            with self.assertRaises(PeriodLockedError):
                period_guards.assert_period_plannable_daily(session_id, date(2026, 5, 2), object())


if __name__ == "__main__":
    unittest.main()
