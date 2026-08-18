import unittest
from datetime import date

from app.services.goal_truth_service import decorate_goal_truth
from app.utils.date_utils import week_number_for


class GoalTruthServiceTests(unittest.TestCase):
    def test_linked_daily_activity_moves_weekly_and_monthly_goals_out_of_not_started(self):
        today = date(2026, 7, 13)
        week_number = week_number_for(today, "monday")

        decorated = decorate_goal_truth(
            yearly_goals=[],
            monthly_goals=[
                {"id": "monthly-1", "year": 2026, "month": 7, "status": "active", "progress": 0}
            ],
            weekly_goals=[
                {
                    "id": "weekly-1",
                    "monthly_goal_id": "monthly-1",
                    "year": 2026,
                    "week_number": week_number,
                    "status": "active",
                    "progress": 0,
                }
            ],
            daily_priorities=[
                {
                    "id": "priority-1",
                    "weekly_goal_id": "weekly-1",
                    "date": today.isoformat(),
                    "status": "active",
                    "completed": False,
                }
            ],
            today=today,
            week_starts_on="monday",
        )

        self.assertEqual(decorated["weekly_goals"][0]["truth_status"], "in_progress")
        self.assertEqual(decorated["monthly_goals"][0]["truth_status"], "in_progress")
        self.assertTrue(decorated["weekly_goals"][0]["has_activity"])
        self.assertTrue(decorated["monthly_goals"][0]["has_activity"])

    def test_completed_child_work_marks_weekly_goal_review_ready(self):
        today = date(2026, 7, 13)
        week_number = week_number_for(today, "monday")

        decorated = decorate_goal_truth(
            yearly_goals=[],
            monthly_goals=[],
            weekly_goals=[
                {
                    "id": "weekly-1",
                    "year": 2026,
                    "week_number": week_number,
                    "status": "active",
                    "progress": 0,
                }
            ],
            daily_priorities=[
                {
                    "id": "priority-1",
                    "weekly_goal_id": "weekly-1",
                    "date": today.isoformat(),
                    "status": "completed",
                    "completed": True,
                }
            ],
            today=today,
            week_starts_on="monday",
        )

        weekly_goal = decorated["weekly_goals"][0]
        self.assertEqual(weekly_goal["truth_status"], "review_ready")
        self.assertEqual(weekly_goal["truth_progress"], 100)
        self.assertEqual(weekly_goal["completed_children_count"], 1)

    def test_closed_month_without_completion_becomes_at_risk(self):
        decorated = decorate_goal_truth(
            yearly_goals=[],
            monthly_goals=[
                {"id": "monthly-1", "year": 2026, "month": 6, "status": "active", "progress": 0}
            ],
            weekly_goals=[],
            daily_priorities=[],
            today=date(2026, 7, 13),
            week_starts_on="monday",
        )

        monthly_goal = decorated["monthly_goals"][0]
        self.assertEqual(monthly_goal["truth_status"], "at_risk")
        self.assertTrue(monthly_goal["period_closed"])

    def test_completed_months_make_yearly_goal_review_ready(self):
        decorated = decorate_goal_truth(
            yearly_goals=[
                {"id": "yearly-1", "year": 2026, "status": "active", "progress": 0}
            ],
            monthly_goals=[
                {
                    "id": "monthly-1",
                    "yearly_goal_id": "yearly-1",
                    "year": 2026,
                    "month": 6,
                    "status": "completed",
                    "progress": 100,
                }
            ],
            weekly_goals=[],
            daily_priorities=[],
            today=date(2026, 7, 13),
            week_starts_on="monday",
        )

        yearly_goal = decorated["yearly_goals"][0]
        self.assertEqual(yearly_goal["truth_status"], "review_ready")
        self.assertEqual(yearly_goal["truth_progress"], 100)
        self.assertEqual(yearly_goal["completed_children_count"], 1)


if __name__ == "__main__":
    unittest.main()
