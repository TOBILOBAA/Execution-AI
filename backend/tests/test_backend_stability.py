import os
import unittest
from datetime import date, datetime, timezone
from uuid import uuid4
from unittest.mock import patch

from fastapi.testclient import TestClient
from postgrest.exceptions import APIError


for key, value in {
    "SUPABASE_URL": "http://test.supabase.local",
    "SUPABASE_ANON_KEY": "test-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
    "GOOGLE_AI_API_KEY": "",
    "GEMINI_MODEL": "gemini-2.5-flash",
    "GEMINI_REQUEST_TIMEOUT_MS": "120000",
    "GEMINI_MAX_OUTPUT_TOKENS": "4096",
    "GCP_PROJECT_ID": "",
    "GCP_LOCATION": "us-central1",
    "GCP_IMPERSONATE_SA": "",
    "APP_ENV": "development",
    "CORS_ORIGINS": "",
    "REPORT_CUTOFF_HOUR": "18",
}.items():
    os.environ.setdefault(key, value)

from app.api.deps import get_db
from app.api.routes import execution as execution_routes
from app.db import habits as habits_db
from app.db import reports as reports_db
from app.db import sessions as sessions_db
from app.services import report_service
from app.main import (
    LOCAL_DEVELOPMENT_CORS_ORIGINS,
    app,
    _parse_cors_origin_regex,
    _parse_cors_origins,
)


class FakeResult:
    def __init__(self, data):
        self.data = data


class RecordingTable:
    def __init__(self, result_rows=None, update_error=None):
        self.result_rows = result_rows
        self.update_error = update_error
        self.insert_payload = None
        self.update_payload = None
        self.upsert_payload = None
        self.upsert_conflict = None
        self._maybe_single = False
        self.update_calls = []

    def select(self, *args, **kwargs):
        return self

    def insert(self, payload):
        self.insert_payload = payload
        return self

    def update(self, payload):
        self.update_payload = payload
        self.update_calls.append(payload)
        return self

    def upsert(self, payload, on_conflict=None):
        self.upsert_payload = payload
        self.upsert_conflict = on_conflict
        return self

    def delete(self):
        return self

    def eq(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def gte(self, *args, **kwargs):
        return self

    def lte(self, *args, **kwargs):
        return self

    def maybe_single(self):
        self._maybe_single = True
        return self

    def single(self):
        self._maybe_single = True
        return self

    def execute(self):
        if self.result_rows is not None:
            if self._maybe_single and not self.result_rows:
                return FakeResult(None)
            return FakeResult(self.result_rows)
        if self.update_error is not None and self.update_payload is not None:
            error = self.update_error
            self.update_error = None
            raise error
        if self.insert_payload is not None:
            return FakeResult([self.insert_payload])
        if self.update_payload is not None:
            return FakeResult([self.update_payload])
        if self.upsert_payload is not None:
            return FakeResult([self.upsert_payload])
        return FakeResult([])


class FakeDB:
    def __init__(self, result_rows_by_table=None, update_error_by_table=None):
        self.result_rows_by_table = result_rows_by_table or {}
        self.update_error_by_table = update_error_by_table or {}
        self.tables = {}

    def table(self, name):
        if name not in self.tables:
            self.tables[name] = RecordingTable(
                self.result_rows_by_table.get(name),
                self.update_error_by_table.get(name),
            )
        return self.tables[name]


class BackendStabilityTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides[get_db] = lambda: FakeDB()

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_parse_cors_origins(self):
        self.assertEqual(
            _parse_cors_origins("https://a.example, https://b.example", "production"),
            ["https://a.example", "https://b.example"],
        )
        self.assertEqual(_parse_cors_origins("", "development"), LOCAL_DEVELOPMENT_CORS_ORIGINS)

    def test_parse_cors_origin_regex(self):
        self.assertEqual(
            _parse_cors_origin_regex(r"^https://app\.example$", "production"),
            r"^https://app\.example$",
        )
        self.assertEqual(
            _parse_cors_origin_regex("", "production"),
            r"^https://[a-z0-9-]+\.vercel\.app$",
        )
        self.assertEqual(
            _parse_cors_origin_regex("", "development"),
            r"^https://[a-z0-9-]+\.vercel\.app$",
        )

    def test_session_update_ignores_missing_recap_columns(self):
        session_id = uuid4()
        db = FakeDB(
            update_error_by_table={
                "sessions": APIError(
                    {
                        "message": "Could not find the 'pending_recaps' column in the schema cache",
                        "code": "PGRST204",
                    }
                )
            }
        )

        updated = sessions_db.update_session(
            db,
            session_id,
            {"timezone": "UTC", "pending_recaps": [{"type": "weekly"}], "handled_recaps": ["weekly:2026:::18"]},
        )

        self.assertEqual(updated["timezone"], "UTC")
        self.assertEqual(updated["pending_recaps"], [])
        self.assertEqual(updated["handled_recaps"], [])
        self.assertEqual(len(db.tables["sessions"].update_calls), 2)
        self.assertNotIn("pending_recaps", db.tables["sessions"].update_calls[-1])
        self.assertNotIn("handled_recaps", db.tables["sessions"].update_calls[-1])

    def test_session_start_reuses_existing_auth_user_workspace(self):
        auth_user_id = "user-123"
        existing = {
            "id": str(uuid4()),
            "auth_user_id": auth_user_id,
            "timezone": "UTC",
            "device_hint": auth_user_id,
            "onboarding_step": 4,
            "onboarding_done": True,
            "created_at": "2026-04-15T00:00:00Z",
        }
        db = FakeDB(result_rows_by_table={"sessions": [existing]})

        session = sessions_db.get_or_create_session(
            db,
            device_hint=auth_user_id,
            timezone="UTC",
            auth_user_id=auth_user_id,
        )

        self.assertEqual(session["id"], existing["id"])
        self.assertEqual(session["auth_user_id"], existing["auth_user_id"])
        self.assertEqual(session["timezone"], existing["timezone"])
        self.assertEqual(session["device_hint"], existing["device_hint"])
        self.assertEqual(session["onboarding_step"], existing["onboarding_step"])
        self.assertEqual(session["onboarding_done"], existing["onboarding_done"])
        self.assertEqual(session["created_at"], existing["created_at"])
        self.assertEqual(session["week_starts_on"], "monday")
        self.assertIsNone(db.tables["sessions"].insert_payload)

    def test_session_create_persists_auth_user_id(self):
        auth_user_id = "user-456"
        db = FakeDB()

        session = sessions_db.create_session(
            db,
            device_hint="browser-a",
            timezone="UTC",
            auth_user_id=auth_user_id,
        )

        self.assertEqual(session["auth_user_id"], auth_user_id)
        self.assertEqual(db.tables["sessions"].insert_payload["auth_user_id"], auth_user_id)

    def test_create_and_update_habit_serialize_uuid_fields(self):
        session_id = uuid4()
        category_id = uuid4()
        habit_id = uuid4()
        db = FakeDB()

        created = habits_db.create_habit(
            db,
            session_id,
            {"name": "Focus", "category_id": category_id, "sort_order": 2},
        )
        self.assertEqual(created["session_id"], str(session_id))
        self.assertEqual(db.tables["foundational_habits"].insert_payload["category_id"], str(category_id))

        updated = habits_db.update_habit(
            db,
            habit_id,
            session_id,
            {"category_id": category_id, "active": False},
        )
        self.assertEqual(updated["category_id"], str(category_id))
        self.assertEqual(db.tables["foundational_habits"].update_payload["category_id"], str(category_id))

    def test_get_habit_returns_none_without_raising(self):
        db = FakeDB(result_rows_by_table={"foundational_habits": []})
        self.assertIsNone(habits_db.get_habit(db, uuid4(), uuid4()))

    def test_report_upsert_inserts_new_row_and_updates_existing_natural_key(self):
        session_id = uuid4()
        db = FakeDB()

        inserted = reports_db.upsert_report(
            db,
            session_id,
            {
                "report_type": "daily",
                "period_date": date(2026, 4, 15).isoformat(),
                "period_year": 2026,
                "period_month": 4,
                "metrics": {},
                "status": "ready",
            },
        )
        self.assertEqual(inserted["report_type"], "daily")
        self.assertEqual(db.tables["report_snapshots"].insert_payload["period_date"], "2026-04-15")
        self.assertIsNone(db.tables["report_snapshots"].update_payload)

        existing_db = FakeDB(
            result_rows_by_table={
                "report_snapshots": [
                    {
                        "id": "report-1",
                        "report_type": "yearly",
                        "period_year": 2026,
                        "metrics": {"completion": 40},
                        "status": "ready",
                    }
                ]
            }
        )
        updated = reports_db.upsert_report(
            existing_db,
            session_id,
            {
                "report_type": "yearly",
                "period_year": 2026,
                "metrics": {},
                "status": "ready",
            },
        )
        self.assertEqual(updated["status"], "ready")
        self.assertEqual(existing_db.tables["report_snapshots"].update_payload["period_year"], 2026)
        self.assertIsNone(existing_db.tables["report_snapshots"].insert_payload)

    def test_report_upsert_rejects_unknown_report_type(self):
        session_id = uuid4()
        db = FakeDB()

        with self.assertRaises(ValueError):
            reports_db.upsert_report(
                db,
                session_id,
                {
                    "report_type": "unknown",
                    "period_year": 2026,
                    "metrics": {},
                    "status": "ready",
                },
            )

    def test_report_get_supports_quarterly_natural_key(self):
        session_id = uuid4()
        db = FakeDB(
            result_rows_by_table={
                "report_snapshots": [
                    {
                        "id": "report-q1",
                        "report_type": "quarterly",
                        "period_year": 2026,
                        "period_quarter": 1,
                    }
                ]
            }
        )

        report = reports_db.get_report(
            db,
            session_id,
            report_type="quarterly",
            period_year=2026,
            period_quarter=1,
        )
        self.assertEqual(report["id"], "report-q1")

    def test_report_list_skips_stale_today_refresh_before_cutoff(self):
        session_id = uuid4()
        today = date(2026, 5, 7)
        stale_today = {
            "id": "report-daily-today",
            "report_type": "daily",
            "period_date": today.isoformat(),
            "period_year": today.year,
            "period_month": today.month,
            "status": "stale",
            "metrics": {},
        }

        with (
            patch.object(report_service.reports_db, "list_reports", return_value=[stale_today]),
            patch.object(report_service, "ensure_historical_reports", return_value=[]),
            patch.object(report_service, "_decorate_report", side_effect=lambda db, session_id, report: report),
            patch.object(report_service, "get_session_today", return_value=today),
            patch.object(report_service, "generate_daily_report") as generate_daily_report,
        ):
            listed = report_service.list_reports(FakeDB(), session_id)

        generate_daily_report.assert_not_called()
        self.assertEqual(listed, [stale_today])

    def test_can_refresh_stale_today_daily_report_only_after_cutoff(self):
        today = date(2026, 5, 7)
        report = {
            "report_type": "daily",
            "period_date": today.isoformat(),
            "status": "stale",
        }

        self.assertFalse(
            report_service._can_refresh_stale_daily_report(
                report,
                today,
                datetime(2026, 5, 7, 7, 0, tzinfo=timezone.utc),
                18,
            )
        )
        self.assertTrue(
            report_service._can_refresh_stale_daily_report(
                report,
                today,
                datetime(2026, 5, 7, 18, 0, tzinfo=timezone.utc),
                18,
            )
        )

    def test_create_task_auto_creates_daily_plan(self):
        client = TestClient(app)
        session_id = uuid4()
        plan_date = date(2026, 4, 15)
        weekly_goal_id = uuid4()

        fake_plan = {"id": "daily-plan-1", "date": plan_date.isoformat()}
        fake_priority = {"id": "priority-1", "title": "Ship backend fixes"}

        with (
            patch.object(execution_routes, "assert_period_current_daily"),
            patch.object(execution_routes.plans_db, "get_daily_plan", return_value=None),
            patch.object(execution_routes.plans_db, "get_weekly_plan", return_value=None),
            patch.object(execution_routes.plans_db, "upsert_daily_plan", return_value=fake_plan) as upsert_plan,
            patch.object(execution_routes.plans_db, "create_daily_priority", return_value=fake_priority) as create_priority,
        ):
            response = client.post(
                "/tasks",
                params={"session_id": str(session_id), "date": plan_date.isoformat()},
                json={
                    "title": "Ship backend fixes",
                    "weekly_goal_id": str(weekly_goal_id),
                    "priority": "medium",
                    "is_main": True,
                },
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json(), fake_priority)
        upsert_plan.assert_called_once()
        create_priority.assert_called_once()
        payload = create_priority.call_args.args[1]
        self.assertEqual(payload["session_id"], str(session_id))
        self.assertEqual(payload["daily_plan_id"], "daily-plan-1")
        self.assertEqual(payload["weekly_goal_id"], str(weekly_goal_id))


if __name__ == "__main__":
    unittest.main()
