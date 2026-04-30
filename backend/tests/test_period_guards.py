import unittest
from datetime import date
from uuid import uuid4
from unittest.mock import patch

from app.core.exceptions import PeriodLockedError
from app.utils import period_guards


class PeriodGuardTests(unittest.TestCase):
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
