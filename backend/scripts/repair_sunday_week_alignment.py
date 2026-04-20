#!/usr/bin/env python3
"""
Repair weekly planning data so the product uses Sunday-to-Saturday weeks.

Why this exists:
- Older backend logic used ISO/Monday weeks.
- Historical imports were written as Sunday-start notes.
- That mismatch can shift weekly goals into the wrong week bucket and can also
  pull structured daily entries into the previous Monday-Saturday range.

This script is intentionally admin-oriented:
1. Preview what would change.
2. Apply the repair for one target session.
3. Rebuild report snapshots from the repaired planning history.
"""

from __future__ import annotations

import argparse
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.db.client import get_supabase
import app.db.sessions as sessions_db
from app.services import report_service
from app.utils.date_utils import sunday_week_number, sunday_week_start


MONTH_ABBR = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AUG": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DEC": 12,
}

TEMP_YEAR_OFFSET = 5000

WEEK_LABEL_RE = re.compile(
    r"(Weekly\s+(?P<start_month>[A-Z]{3})\s+(?P<start_day>\d{1,2})\s*-\s*(?:(?P<end_month>[A-Z]{3})\s+)?(?P<end_day>\d{1,2}))"
)


@dataclass
class WeeklyPlanTarget:
    plan_id: str
    year: int
    month: int
    week_number: int
    week_start: date
    week_end: date


def parse_week_start(label_source: str, year_hint: int) -> date | None:
    match = WEEK_LABEL_RE.search(label_source or "")
    if not match:
        return None
    start_month = MONTH_ABBR[match.group("start_month")]
    start_day = int(match.group("start_day"))
    return date(year_hint, start_month, start_day)


def weekday_offset_sunday_first(d: date) -> int:
    return (d.weekday() + 1) % 7


def next_sunday_on_or_after(d: date) -> date:
    return d + timedelta(days=(6 - d.weekday()) % 7)


def resolve_session_id(db, auth_user_id: str | None, session_id: str | None) -> str:
    if session_id:
        return session_id
    if not auth_user_id:
        raise ValueError("Provide either --session-id or --auth-user-id.")
    session = sessions_db.get_session_by_auth_user_id(db, auth_user_id)
    if not session:
        raise ValueError(f"No session found for auth user {auth_user_id}.")
    return session["id"]


def infer_weekly_plan_targets(
    weekly_plans: list[dict],
    daily_plans_by_weekly: dict[str, list[dict]],
    daily_priorities_by_plan: dict[str, list[dict]],
) -> dict[str, WeeklyPlanTarget]:
    targets: dict[str, WeeklyPlanTarget] = {}

    for plan in weekly_plans:
        plan_id = plan["id"]
        label_start: date | None = None
        for daily_plan in daily_plans_by_weekly.get(plan_id, []):
            for priority in daily_priorities_by_plan.get(daily_plan["id"], []):
                label_start = parse_week_start(priority.get("notes") or "", plan["year"])
                if label_start:
                    break
            if label_start:
                break

        if label_start:
            week_start = label_start
        else:
            daily_dates = sorted(
                date.fromisoformat(row["date"])
                for row in daily_plans_by_weekly.get(plan_id, [])
                if row.get("date")
            )
            if daily_dates:
                week_start = sunday_week_start(daily_dates[0])
            else:
                existing_start = date.fromisoformat(plan["week_start"])
                week_start = existing_start if existing_start.weekday() == 6 else next_sunday_on_or_after(existing_start)

        targets[plan_id] = WeeklyPlanTarget(
            plan_id=plan_id,
            year=week_start.year,
            month=week_start.month,
            week_number=sunday_week_number(week_start),
            week_start=week_start,
            week_end=week_start + timedelta(days=6),
        )

    return targets


def choose_keeper(plan_rows: list[dict], goals_by_weekly: dict[str, list[dict]], daily_plans_by_weekly: dict[str, list[dict]]) -> dict:
    def score(row: dict) -> tuple[int, int, str]:
        return (
            len(goals_by_weekly.get(row["id"], [])),
            len(daily_plans_by_weekly.get(row["id"], [])),
            row.get("created_at") or "",
        )

    return max(plan_rows, key=score)


def ensure_daily_plan(db, session_id: str, weekly_plan_id: str, target_date: date, existing_by_date: dict[str, dict]) -> dict:
    iso = target_date.isoformat()
    existing = existing_by_date.get(iso)
    if existing:
        if existing.get("weekly_plan_id") != weekly_plan_id:
            existing = (
                db.table("daily_plans")
                .update({"weekly_plan_id": weekly_plan_id})
                .eq("id", existing["id"])
                .execute()
                .data[0]
            )
            existing_by_date[iso] = existing
        return existing

    created = (
        db.table("daily_plans")
        .upsert(
            {
                "session_id": session_id,
                "weekly_plan_id": weekly_plan_id,
                "date": iso,
                "status": "draft",
            },
            on_conflict="session_id,date",
        )
        .execute()
        .data[0]
    )
    existing_by_date[iso] = created
    return created


def preview_summary(
    weekly_plans: list[dict],
    targets: dict[str, WeeklyPlanTarget],
    daily_priorities: list[dict],
    habit_logs: list[dict],
) -> dict:
    shifted_plan_ranges = [
        (
            date.fromisoformat(plan["week_start"]),
            date.fromisoformat(plan["week_end"]),
            targets[plan["id"]].week_start,
        )
        for plan in weekly_plans
        if (
            plan["year"],
            plan["month"],
            plan["week_number"],
            plan["week_start"],
            plan["week_end"],
        )
        != (
            targets[plan["id"]].year,
            targets[plan["id"]].month,
            targets[plan["id"]].week_number,
            targets[plan["id"]].week_start.isoformat(),
            targets[plan["id"]].week_end.isoformat(),
        )
    ]
    shifted_weekly_plans = sum(
        1
        for plan in weekly_plans
        if (
            plan["year"],
            plan["month"],
            plan["week_number"],
            plan["week_start"],
            plan["week_end"],
        )
        != (
            targets[plan["id"]].year,
            targets[plan["id"]].month,
            targets[plan["id"]].week_number,
            targets[plan["id"]].week_start.isoformat(),
            targets[plan["id"]].week_end.isoformat(),
        )
    )
    structured_priority_repairs = sum(1 for row in daily_priorities if WEEK_LABEL_RE.search(row.get("notes") or ""))
    structured_habit_repairs = 0
    for row in habit_logs:
        log_date = date.fromisoformat(row["date"])
        if any(old_start <= log_date <= old_end for old_start, old_end, _target_start in shifted_plan_ranges):
            structured_habit_repairs += 1
    return {
        "weekly_plans_total": len(weekly_plans),
        "weekly_plans_retargeted": shifted_weekly_plans,
        "daily_priorities_with_week_labels": structured_priority_repairs,
        "habit_logs_with_week_labels": structured_habit_repairs,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Repair Sunday-start week alignment for one session.")
    parser.add_argument("--auth-user-id", help="Target auth user id.")
    parser.add_argument("--session-id", help="Target session id.")
    parser.add_argument("--apply", action="store_true", help="Persist the repair.")
    args = parser.parse_args()

    db = get_supabase()
    session_id = resolve_session_id(db, args.auth_user_id, args.session_id)

    weekly_plans = (
        db.table("weekly_plans")
        .select("*")
        .eq("session_id", session_id)
        .order("year")
        .order("week_number")
        .execute()
        .data
        or []
    )
    weekly_goals = (
        db.table("weekly_goals")
        .select("*")
        .eq("session_id", session_id)
        .execute()
        .data
        or []
    )
    daily_plans = (
        db.table("daily_plans")
        .select("*")
        .eq("session_id", session_id)
        .execute()
        .data
        or []
    )
    daily_priorities = (
        db.table("daily_priorities")
        .select("*")
        .eq("session_id", session_id)
        .execute()
        .data
        or []
    )
    habit_logs = (
        db.table("habit_logs")
        .select("*")
        .eq("session_id", session_id)
        .execute()
        .data
        or []
    )

    goals_by_weekly: dict[str, list[dict]] = defaultdict(list)
    for row in weekly_goals:
        if row.get("weekly_plan_id"):
            goals_by_weekly[row["weekly_plan_id"]].append(row)

    daily_plans_by_weekly: dict[str, list[dict]] = defaultdict(list)
    for row in daily_plans:
        if row.get("weekly_plan_id"):
            daily_plans_by_weekly[row["weekly_plan_id"]].append(row)

    daily_priorities_by_plan: dict[str, list[dict]] = defaultdict(list)
    for row in daily_priorities:
        if row.get("daily_plan_id"):
            daily_priorities_by_plan[row["daily_plan_id"]].append(row)

    targets = infer_weekly_plan_targets(weekly_plans, daily_plans_by_weekly, daily_priorities_by_plan)
    summary = preview_summary(weekly_plans, targets, daily_priorities, habit_logs)

    print("Preview summary:")
    print(summary)
    print("Sample weekly shifts:")
    sample = 0
    for plan in weekly_plans:
        target = targets[plan["id"]]
        old_tuple = (plan["year"], plan["week_number"], plan["week_start"], plan["week_end"])
        new_tuple = (target.year, target.week_number, target.week_start.isoformat(), target.week_end.isoformat())
        if old_tuple != new_tuple:
            print(f"- {plan['id']}: {old_tuple} -> {new_tuple}")
            sample += 1
            if sample >= 12:
                break

    if not args.apply:
        return

    # Move weekly plans out of the way first so final Sunday-based week numbers
    # can be written back without tripping the unique (session_id, year,
    # week_number) constraint mid-migration.
    for plan in weekly_plans:
        db.table("weekly_plans").update(
            {"year": plan["year"] + TEMP_YEAR_OFFSET}
        ).eq("id", plan["id"]).execute()

    # Step 1: merge duplicate weekly plan targets and retarget weekly plans/goals.
    grouped_targets: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for plan in weekly_plans:
        target = targets[plan["id"]]
        grouped_targets[(target.year, target.week_number)].append(plan)

    canonical_plan_id_by_old_id: dict[str, str] = {}
    for _target_key, plan_rows in grouped_targets.items():
        keeper = choose_keeper(plan_rows, goals_by_weekly, daily_plans_by_weekly)
        keeper_target = targets[keeper["id"]]

        updated_keeper = (
            db.table("weekly_plans")
            .update(
                {
                    "year": keeper_target.year,
                    "month": keeper_target.month,
                    "week_number": keeper_target.week_number,
                    "week_start": keeper_target.week_start.isoformat(),
                    "week_end": keeper_target.week_end.isoformat(),
                }
            )
            .eq("id", keeper["id"])
            .execute()
            .data[0]
        )
        canonical_plan_id_by_old_id[keeper["id"]] = updated_keeper["id"]

        for goal in goals_by_weekly.get(keeper["id"], []):
            db.table("weekly_goals").update(
                {
                    "year": keeper_target.year,
                    "month": keeper_target.month,
                    "week_number": keeper_target.week_number,
                }
            ).eq("id", goal["id"]).execute()

        for plan in plan_rows:
            canonical_plan_id_by_old_id[plan["id"]] = updated_keeper["id"]
            if plan["id"] == keeper["id"]:
                continue

            for goal in goals_by_weekly.get(plan["id"], []):
                db.table("weekly_goals").update(
                    {
                        "weekly_plan_id": updated_keeper["id"],
                        "year": keeper_target.year,
                        "month": keeper_target.month,
                        "week_number": keeper_target.week_number,
                    }
                ).eq("id", goal["id"]).execute()

            for daily_plan in daily_plans_by_weekly.get(plan["id"], []):
                db.table("daily_plans").update(
                    {"weekly_plan_id": updated_keeper["id"]}
                ).eq("id", daily_plan["id"]).execute()

            db.table("weekly_plans").delete().eq("id", plan["id"]).execute()

    # Refresh daily plan map after any weekly-plan merges.
    daily_plans = (
        db.table("daily_plans")
        .select("*")
        .eq("session_id", session_id)
        .execute()
        .data
        or []
    )
    daily_plan_by_id = {row["id"]: row for row in daily_plans}
    daily_plan_by_date = {row["date"]: row for row in daily_plans}

    # Step 2: repair structured daily priorities.
    for row in daily_priorities:
        match = WEEK_LABEL_RE.search(row.get("notes") or "")
        if not match:
            continue
        current_date = date.fromisoformat(row["date"])
        target_start = parse_week_start(match.group(0), current_date.year)
        if not target_start:
            continue
        corrected_date = target_start + timedelta(days=weekday_offset_sunday_first(current_date))

        current_plan = daily_plan_by_id.get(row.get("daily_plan_id"))
        old_weekly_plan_id = current_plan.get("weekly_plan_id") if current_plan else None
        weekly_plan_id = canonical_plan_id_by_old_id.get(old_weekly_plan_id, old_weekly_plan_id)
        if not weekly_plan_id:
            continue

        canonical_plan = ensure_daily_plan(db, session_id, weekly_plan_id, corrected_date, daily_plan_by_date)
        db.table("daily_priorities").update(
            {
                "date": corrected_date.isoformat(),
                "daily_plan_id": canonical_plan["id"],
            }
        ).eq("id", row["id"]).execute()

    # Step 3: repair structured habit logs.
    shifted_ranges = [
        (
            date.fromisoformat(plan["week_start"]),
            date.fromisoformat(plan["week_end"]),
            targets[plan["id"]].week_start,
        )
        for plan in weekly_plans
    ]
    for row in habit_logs:
        current_date = date.fromisoformat(row["date"])
        target_start = None
        for old_start, old_end, candidate_start in shifted_ranges:
            if old_start <= current_date <= old_end:
                target_start = candidate_start
                break
        if not target_start:
            continue
        corrected_date = target_start + timedelta(days=weekday_offset_sunday_first(current_date))
        if corrected_date == current_date:
            continue

        existing = (
            db.table("habit_logs")
            .select("*")
            .eq("habit_id", row["habit_id"])
            .eq("date", corrected_date.isoformat())
            .execute()
            .data
            or []
        )
        if existing:
            merged_completed = bool(existing[0].get("completed") or row.get("completed"))
            db.table("habit_logs").update(
                {"completed": merged_completed}
            ).eq("id", existing[0]["id"]).execute()
            db.table("habit_logs").delete().eq("id", row["id"]).execute()
        else:
            db.table("habit_logs").update(
                {"date": corrected_date.isoformat()}
            ).eq("id", row["id"]).execute()

    # Step 4: drop orphan daily plans left behind by repaired priorities.
    refreshed_priorities = (
        db.table("daily_priorities")
        .select("daily_plan_id")
        .eq("session_id", session_id)
        .execute()
        .data
        or []
    )
    active_daily_plan_ids = {row["daily_plan_id"] for row in refreshed_priorities if row.get("daily_plan_id")}
    for row in daily_plans:
        if row["id"] not in active_daily_plan_ids:
            db.table("daily_plans").delete().eq("id", row["id"]).execute()

    # Step 5: rebuild report snapshots from the repaired planning data.
    db.table("report_snapshots").delete().eq("session_id", session_id).execute()
    report_service.list_reports(db, session_id)

    print("Applied repair.")
    repaired_reports = (
        db.table("report_snapshots")
        .select("id", count="exact")
        .eq("session_id", session_id)
        .execute()
    )
    print(
        {
            "session_id": session_id,
            "weekly_plans": len(weekly_plans),
            "report_snapshots": repaired_reports.count,
        }
    )


if __name__ == "__main__":
    main()
