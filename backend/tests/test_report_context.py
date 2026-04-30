import unittest
from datetime import date
from uuid import uuid4
from unittest.mock import patch

from app.services import report_context


class ReportContextTests(unittest.TestCase):
    def test_build_execution_diary_returns_grounded_structured_signals(self):
        loaded = {
            "categories": [{"id": "cat-1", "name": "Career"}],
            "yearly_goals": [
                {"id": "yg-1", "title": "Raise fund", "status": "completed", "category_id": "cat-1"},
            ],
            "monthly_goals": [
                {
                    "id": "mg-1",
                    "title": "Investor deck",
                    "status": "missed",
                    "yearly_goal_id": "yg-1",
                    "category_id": "cat-1",
                },
            ],
            "weekly_goals": [
                {
                    "id": "wg-1",
                    "title": "Ship deck draft",
                    "status": "completed",
                    "monthly_goal_id": "mg-1",
                },
            ],
            "weekly_plans": [],
            "habits": [
                {"id": "h-1", "name": "Morning planning", "frequency": "daily", "active": True},
            ],
        }
        priorities = [
            {
                "title": "Draft intro",
                "date": "2026-04-01",
                "completed": True,
                "weekly_goal_id": "wg-1",
                "completed_at": "2026-04-01T09:00:00Z",
            },
            {
                "title": "Revise slide flow",
                "date": "2026-04-01",
                "completed": False,
                "weekly_goal_id": "wg-1",
                "completed_at": None,
            },
            {
                "title": "Send deck",
                "date": "2026-04-02",
                "completed": True,
                "weekly_goal_id": "wg-1",
                "completed_at": "2026-04-03T08:00:00Z",
            },
        ]
        habit_logs = [
            {"habit_id": "h-1", "date": "2026-04-01", "completed": True},
            {"habit_id": "h-1", "date": "2026-04-02", "completed": False},
        ]

        with (
            patch.object(report_context, "_load_goals_and_habits", return_value=loaded),
            patch.object(report_context.plans_db, "list_daily_priorities_for_range", return_value=priorities),
            patch.object(report_context.habits_db, "list_habit_logs_for_session", return_value=habit_logs),
            patch.object(report_context.sessions_db, "get_effective_week_starts_on", return_value="monday"),
        ):
            diary = report_context.build_execution_diary(
                uuid4(),
                date(2026, 4, 1),
                date(2026, 4, 2),
                object(),
            )

        self.assertEqual(
            diary["daily_completion_counts"],
            [
                {"date": "2026-04-01", "complete": 1, "total": 2},
                {"date": "2026-04-02", "complete": 1, "total": 1},
            ],
        )
        self.assertEqual(diary["category_completion"]["Career"], 67)
        self.assertEqual(
            diary["habit_holds"],
            [{"habit_name": "Morning planning", "days_held": 1, "days_dropped": 1}],
        )
        self.assertEqual(diary["goals_shipped"], ["Raise fund", "Ship deck draft"])
        self.assertEqual(diary["goals_missed"], ["Investor deck"])
        self.assertEqual(
            diary["late_completions"],
            [
                {
                    "title": "Send deck",
                    "completed_at": "2026-04-03T08:00:00+00:00",
                    "scheduled_for": "2026-04-02",
                },
            ],
        )

    def test_build_execution_diary_respects_user_week_start_for_weekly_habits(self):
        loaded = {
            "categories": [],
            "yearly_goals": [],
            "monthly_goals": [],
            "weekly_goals": [],
            "weekly_plans": [],
            "habits": [
                {"id": "h-1", "name": "Founder review", "frequency": "weekly", "active": True},
            ],
        }
        habit_logs = [
            {"habit_id": "h-1", "date": "2026-04-04", "completed": True},
        ]

        with (
            patch.object(report_context, "_load_goals_and_habits", return_value=loaded),
            patch.object(report_context.plans_db, "list_daily_priorities_for_range", return_value=[]),
            patch.object(report_context.habits_db, "list_habit_logs_for_session", return_value=habit_logs),
            patch.object(report_context.sessions_db, "get_effective_week_starts_on", return_value="sunday"),
        ):
            diary = report_context.build_execution_diary(
                uuid4(),
                date(2026, 4, 4),
                date(2026, 4, 5),
                object(),
            )

        self.assertEqual(
            diary["habit_holds"],
            [{"habit_name": "Founder review", "days_held": 1, "days_dropped": 1}],
        )

    def test_build_report_prompt_context_keeps_goal_hierarchy_links(self):
        loaded = {
            "categories": [{"id": "cat-1", "name": "Career"}],
            "yearly_goals": [
                {
                    "id": "yg-1",
                    "title": "Raise fund",
                    "description": "Close the round.",
                    "target_date": "2026-12-31",
                    "category_id": "cat-1",
                    "progress": 40,
                },
            ],
            "monthly_goals": [
                {
                    "id": "mg-1",
                    "title": "Investor deck",
                    "description": "Finalize the deck.",
                    "workload": "~12h",
                    "is_main": True,
                    "progress": 60,
                    "yearly_goal_id": "yg-1",
                    "category_id": "cat-1",
                    "target_date": "2026-04-30",
                },
            ],
            "weekly_goals": [
                {
                    "id": "wg-1",
                    "title": "Ship deck draft",
                    "description": "Version one to advisors.",
                    "target_day": "thu",
                    "is_main": True,
                    "progress": 75,
                    "monthly_goal_id": "mg-1",
                    "workload": "~4h",
                },
            ],
            "weekly_plans": [],
            "habits": [
                {"id": "h-1", "name": "Morning planning", "frequency": "daily", "active": True, "category_id": "cat-1"},
            ],
        }

        with patch.object(report_context, "_load_goals_and_habits", return_value=loaded):
            context = report_context.build_report_prompt_context(
                uuid4(),
                date(2026, 4, 1),
                date(2026, 4, 7),
                object(),
            )

        self.assertEqual(context["yearly_goals_summary"][0]["title"], "Raise fund")
        self.assertEqual(context["monthly_goals_full"][0]["parent_yearly_title"], "Raise fund")
        self.assertEqual(context["weekly_goals_full"][0]["parent_monthly_title"], "Investor deck")
        self.assertEqual(context["weekly_goals_full"][0]["parent_yearly_title"], "Raise fund")
        self.assertEqual(context["active_habits"][0]["category"], "Career")


if __name__ == "__main__":
    unittest.main()
