import os
import unittest
from datetime import date
from uuid import uuid4
from unittest.mock import patch

from fastapi.testclient import TestClient


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
from app.main import app, _parse_cors_origin_regex, _parse_cors_origins


class FakeResult:
    def __init__(self, data):
        self.data = data


class RecordingTable:
    def __init__(self, result_rows=None):
        self.result_rows = result_rows
        self.insert_payload = None
        self.update_payload = None
        self.upsert_payload = None
        self.upsert_conflict = None
        self._maybe_single = False

    def select(self, *args, **kwargs):
        return self

    def insert(self, payload):
        self.insert_payload = payload
        return self

    def update(self, payload):
        self.update_payload = payload
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
        if self.insert_payload is not None:
            return FakeResult([self.insert_payload])
        if self.update_payload is not None:
            return FakeResult([self.update_payload])
        if self.upsert_payload is not None:
            return FakeResult([self.upsert_payload])
        return FakeResult([])


class FakeDB:
    def __init__(self, result_rows_by_table=None):
        self.result_rows_by_table = result_rows_by_table or {}
        self.tables = {}

    def table(self, name):
        if name not in self.tables:
            self.tables[name] = RecordingTable(self.result_rows_by_table.get(name))
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
        self.assertEqual(_parse_cors_origins("", "development"), ["*"])

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

        self.assertEqual(session, existing)
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

    def test_report_upsert_uses_period_specific_conflict_target(self):
        session_id = uuid4()
        db = FakeDB()

        reports_db.upsert_report(
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
        self.assertEqual(
            db.tables["report_snapshots"].upsert_conflict,
            "session_id,report_type,period_date",
        )

        reports_db.upsert_report(
            db,
            session_id,
            {
                "report_type": "yearly",
                "period_year": 2026,
                "metrics": {},
                "status": "ready",
            },
        )
        self.assertEqual(
            db.tables["report_snapshots"].upsert_conflict,
            "session_id,report_type,period_year",
        )

    def test_create_task_auto_creates_daily_plan(self):
        client = TestClient(app)
        session_id = uuid4()
        plan_date = date(2026, 4, 15)
        weekly_goal_id = uuid4()

        fake_plan = {"id": "daily-plan-1", "date": plan_date.isoformat()}
        fake_priority = {"id": "priority-1", "title": "Ship backend fixes"}

        with (
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
