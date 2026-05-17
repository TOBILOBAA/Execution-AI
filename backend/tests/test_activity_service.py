import os
import unittest
from datetime import date, datetime, timezone
from uuid import uuid4
from unittest.mock import patch


for key, value in {
    "SUPABASE_URL": "http://test.supabase.local",
    "SUPABASE_ANON_KEY": "test-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
}.items():
    os.environ.setdefault(key, value)

from app.services import activity_service


class ActivityServiceTests(unittest.TestCase):
    def test_touch_app_open_sets_daily_row_and_session_presence(self):
        session_id = uuid4()
        seen_at = datetime(2026, 5, 17, 9, 30, tzinfo=timezone.utc)
        session = {
            "id": str(session_id),
            "auth_user_id": "user-1",
            "timezone": "UTC",
        }

        with (
            patch("app.services.activity_service.sessions_db.get_session", return_value=session),
            patch("app.services.activity_service.get_session_today", return_value=date(2026, 5, 17)),
            patch("app.services.activity_service.get_session_now", return_value=seen_at),
            patch("app.services.activity_service.activity_db.get_daily_activity", return_value=None),
            patch("app.services.activity_service.activity_db.upsert_daily_activity") as upsert_activity,
            patch("app.services.activity_service.sessions_db.update_session") as update_session,
        ):
            upsert_activity.side_effect = lambda db, payload: payload

            row = activity_service.touch_app_open(object(), session_id)

        self.assertTrue(row["opened_app"])
        self.assertEqual(row["activity_date"], "2026-05-17")
        self.assertEqual(row["auth_user_id"], "user-1")
        self.assertEqual(row["first_seen_at"], seen_at.isoformat())
        update_session.assert_called_once()
        self.assertEqual(
            update_session.call_args.args[2],
            {
                "last_seen_at": seen_at.isoformat(),
                "last_opened_date_local": "2026-05-17",
            },
        )

    def test_sync_daily_execution_counts_uses_actual_completed_state(self):
        session_id = uuid4()
        seen_at = datetime(2026, 5, 17, 18, 0, tzinfo=timezone.utc)
        session = {
            "id": str(session_id),
            "auth_user_id": "user-2",
            "timezone": "UTC",
        }
        priorities = [
            {"completed": True},
            {"completed": False},
            {"completed": True},
        ]
        habit_logs = [
            {"completed": True},
            {"completed": False},
        ]

        with (
            patch("app.services.activity_service.sessions_db.get_session", return_value=session),
            patch("app.services.activity_service.get_session_today", return_value=date(2026, 5, 17)),
            patch("app.services.activity_service.get_session_now", return_value=seen_at),
            patch("app.services.activity_service.plans_db.list_daily_priorities", return_value=priorities),
            patch("app.services.activity_service.habits_db.list_habit_logs_for_session", return_value=habit_logs),
            patch("app.services.activity_service.activity_db.get_daily_activity", return_value={"opened_app": True}),
            patch("app.services.activity_service.activity_db.upsert_daily_activity") as upsert_activity,
            patch("app.services.activity_service.sessions_db.update_session") as update_session,
        ):
            upsert_activity.side_effect = lambda db, payload: payload

            row = activity_service.sync_daily_execution_counts(object(), session_id)

        self.assertEqual(row["completed_tasks_count"], 2)
        self.assertEqual(row["completed_habits_count"], 1)
        self.assertTrue(row["opened_app"])
        self.assertEqual(
            update_session.call_args.args[2],
            {
                "last_seen_at": seen_at.isoformat(),
                "last_opened_date_local": "2026-05-17",
                "last_active_at": seen_at.isoformat(),
            },
        )

    def test_get_activity_overview_derives_stage_and_evidence(self):
        session_id = uuid4()
        with (
            patch(
                "app.services.activity_service.sessions_db.get_session",
                return_value={
                    "id": str(session_id),
                    "onboarding_done": True,
                    "last_seen_at": "2026-05-17T10:00:00+00:00",
                    "last_active_at": "2026-05-17T10:05:00+00:00",
                    "last_opened_date_local": "2026-05-17",
                },
            ),
            patch("app.services.activity_service.get_session_today", return_value=date(2026, 5, 17)),
            patch(
                "app.services.activity_service.activity_db.list_daily_activity",
                return_value=[
                    {
                        "activity_date": "2026-05-17",
                        "completed_tasks_count": 1,
                        "completed_habits_count": 0,
                        "approved_next_day_review": False,
                        "handled_recap": False,
                    }
                ],
            ),
            patch(
                "app.services.activity_service.get_onboarding_evidence",
                return_value={
                    "has_yearly_goals": True,
                    "has_monthly_goals": True,
                    "has_weekly_goals": True,
                    "has_daily_plan": True,
                    "complete": True,
                },
            ),
        ):
            overview = activity_service.get_activity_overview(object(), session_id)

        self.assertEqual(overview["current_stage"], "executing")
        self.assertEqual(overview["days_since_last_seen"], 0)
        self.assertTrue(overview["onboarding_evidence"]["complete"])


if __name__ == "__main__":
    unittest.main()
