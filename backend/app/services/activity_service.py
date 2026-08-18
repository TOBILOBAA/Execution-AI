"""Behavioral analytics pipeline for user activity and exports."""
from __future__ import annotations

import csv
import io
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from uuid import UUID

from postgrest.exceptions import APIError
from supabase import Client

import app.db.activity as activity_db
import app.db.habits as habits_db
import app.db.plans as plans_db
import app.db.sessions as sessions_db
import app.db.yearly_goals as yearly_goals_db
from app.core.logging import logger
from app.utils.period_guards import get_session_now, get_session_today


_ONBOARDING_STAGE_BY_STEP = {
    1: "yearly",
    2: "monthly",
    3: "weekly",
    4: "daily",
}


def _coerce_dt(raw: object | None) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


def _coerce_date(raw: object | None) -> date | None:
    if raw is None:
        return None
    if isinstance(raw, date) and not isinstance(raw, datetime):
        return raw
    if isinstance(raw, datetime):
        return raw.date()
    try:
        return date.fromisoformat(str(raw)[:10])
    except ValueError:
        return None


def _auth_attr(user: object, key: str, default=None):
    if isinstance(user, dict):
        return user.get(key, default)
    return getattr(user, key, default)


def _extract_auth_user_batch(result: object) -> list[object]:
    if isinstance(result, list):
        return result
    users = getattr(result, "users", None)
    if isinstance(users, list):
        return users
    data = getattr(result, "data", None)
    if isinstance(data, dict):
        users = data.get("users")
        if isinstance(users, list):
            return users
    return []


def parse_device_context(user_agent: str | None) -> dict[str, str | None]:
    ua = (user_agent or "").strip()
    ua_l = ua.lower()
    device_type = "unknown"
    device_family = "unknown"
    os_name = "unknown"
    browser_name = "unknown"

    if "ipad" in ua_l:
        device_type = "tablet"
        device_family = "ipad"
        os_name = "iPadOS"
    elif "iphone" in ua_l:
        device_type = "mobile"
        device_family = "iphone"
        os_name = "iOS"
    elif "android" in ua_l and "mobile" in ua_l:
        device_type = "mobile"
        device_family = "android_phone"
        os_name = "Android"
    elif "android" in ua_l:
        device_type = "tablet"
        device_family = "android_tablet"
        os_name = "Android"
    elif "mac os x" in ua_l or "macintosh" in ua_l:
        device_type = "desktop"
        device_family = "mac"
        os_name = "macOS"
    elif "windows" in ua_l:
        device_type = "desktop"
        device_family = "windows_pc"
        os_name = "Windows"
    elif "cros" in ua_l:
        device_type = "desktop"
        device_family = "chromebook"
        os_name = "ChromeOS"
    elif "linux" in ua_l:
        device_type = "desktop"
        device_family = "linux_pc"
        os_name = "Linux"

    if "edg/" in ua_l:
        browser_name = "Edge"
    elif "firefox/" in ua_l:
        browser_name = "Firefox"
    elif "chrome/" in ua_l and "edg/" not in ua_l:
        browser_name = "Chrome"
    elif "safari/" in ua_l and "chrome/" not in ua_l:
        browser_name = "Safari"

    return {
        "device_type": device_type,
        "device_family": device_family,
        "os_name": os_name,
        "browser_name": browser_name,
        "user_agent": ua or None,
    }


def list_auth_users(db: Client) -> list[dict]:
    users: list[dict] = []
    page = 1
    while True:
        result = db.auth.admin.list_users(page=page, per_page=200)
        batch = _extract_auth_user_batch(result)
        if not batch:
            break
        for user in batch:
            metadata = _auth_attr(user, "user_metadata", {}) or {}
            auth_name = (
                (metadata.get("full_name") if isinstance(metadata, dict) else None)
                or (metadata.get("name") if isinstance(metadata, dict) else None)
            )
            users.append(
                {
                    "id": _auth_attr(user, "id"),
                    "email": _auth_attr(user, "email"),
                    "created_at": _coerce_dt(_auth_attr(user, "created_at")),
                    "name": auth_name,
                }
            )
        if len(batch) < 200:
            break
        page += 1
    return users


def _now_and_local_date(db: Client, session_id: UUID, activity_date: date | None = None) -> tuple[datetime, date]:
    now = get_session_now(db, session_id)
    return now, activity_date or now.date()


def _safe_update_session_touch(db: Client, session_id: UUID, updates: dict) -> None:
    try:
        sessions_db.update_session(db, session_id, updates)
    except APIError as exc:
        details = str(exc).lower()
        if "last_seen_at" in details or "last_active_at" in details or "last_opened_date_local" in details:
            logger.warning("analytics_session_columns_missing", session_id=str(session_id), error=str(exc))
            return
        raise
    except IndexError as exc:
        logger.warning("analytics_session_touch_skipped", session_id=str(session_id), error=str(exc))
        return


def _merge_daily_activity(existing: dict | None, payload: dict) -> dict:
    base = dict(existing or {})
    merged = {**base, **payload}
    for key in (
        "opened_app",
        "reached_dashboard",
        "completed_onboarding",
        "created_yearly_goal",
        "created_monthly_goal",
        "created_weekly_goal",
        "created_daily_plan",
        "opened_next_day_review",
        "approved_next_day_review",
        "opened_reports",
        "handled_recap",
    ):
        merged[key] = bool(base.get(key)) or bool(payload.get(key))
    if existing and existing.get("first_seen_at") and not payload.get("first_seen_at"):
        merged["first_seen_at"] = existing["first_seen_at"]
    merged["completed_tasks_count"] = int(payload.get("completed_tasks_count", base.get("completed_tasks_count") or 0))
    merged["completed_habits_count"] = int(payload.get("completed_habits_count", base.get("completed_habits_count") or 0))
    for key in (
        "main_tasks_total",
        "main_tasks_completed",
        "secondary_tasks_total",
        "secondary_tasks_completed",
        "habits_total",
        "daily_completion_score",
    ):
        merged[key] = int(payload.get(key, base.get(key) or 0))
    for key in ("completed_any_meaningful_work", "main_goal_completed"):
        merged[key] = bool(payload.get(key, base.get(key) or False))
    for key in ("device_type", "device_family", "os_name", "browser_name"):
        merged[key] = payload.get(key) or base.get(key)
    return merged


def _upsert_activity_payload(db: Client, session: dict, activity_date: date, payload: dict) -> dict | None:
    existing = activity_db.get_daily_activity(db, UUID(str(session["id"])), activity_date)
    base = {
        "session_id": str(session["id"]),
        "auth_user_id": session.get("auth_user_id"),
        "activity_date": activity_date.isoformat(),
        "timezone": session.get("timezone") or "UTC",
        "first_seen_at": payload.get("first_seen_at"),
        "last_seen_at": payload.get("last_seen_at"),
    }
    return activity_db.upsert_daily_activity(db, _merge_daily_activity(existing, {**base, **payload}))


def record_activity(
    db: Client,
    session_id: UUID,
    *,
    activity_date: date | None = None,
    opened_app: bool = False,
    completed_onboarding: bool = False,
    reached_dashboard: bool = False,
    created_yearly_goal: bool = False,
    created_monthly_goal: bool = False,
    created_weekly_goal: bool = False,
    created_daily_plan: bool = False,
    opened_next_day_review: bool = False,
    approved_next_day_review: bool = False,
    opened_reports: bool = False,
    handled_recap: bool = False,
    completed_tasks_count: int | None = None,
    completed_habits_count: int | None = None,
    main_tasks_total: int | None = None,
    main_tasks_completed: int | None = None,
    secondary_tasks_total: int | None = None,
    secondary_tasks_completed: int | None = None,
    habits_total: int | None = None,
    main_goal_completed: bool | None = None,
    completed_any_meaningful_work: bool | None = None,
    daily_completion_score: int | None = None,
    user_agent: str | None = None,
) -> dict | None:
    session = sessions_db.get_session(db, session_id)
    if not session:
        return None

    now, local_date = _now_and_local_date(db, session_id, activity_date)
    touch_updates = {"last_seen_at": now.isoformat()}
    if any(
        (
            opened_app,
            reached_dashboard,
            completed_onboarding,
            created_yearly_goal,
            created_monthly_goal,
            created_weekly_goal,
            created_daily_plan,
            opened_next_day_review,
            approved_next_day_review,
            opened_reports,
            handled_recap,
            completed_tasks_count is not None,
            completed_habits_count is not None,
        )
    ):
        touch_updates["last_active_at"] = now.isoformat()
    if opened_app:
        touch_updates["last_opened_date_local"] = local_date.isoformat()
    _safe_update_session_touch(db, session_id, touch_updates)

    payload = {
        "first_seen_at": now.isoformat(),
        "last_seen_at": now.isoformat(),
        "opened_app": opened_app,
        "reached_dashboard": reached_dashboard,
        "completed_onboarding": completed_onboarding,
        "created_yearly_goal": created_yearly_goal,
        "created_monthly_goal": created_monthly_goal,
        "created_weekly_goal": created_weekly_goal,
        "created_daily_plan": created_daily_plan,
        "opened_next_day_review": opened_next_day_review,
        "approved_next_day_review": approved_next_day_review,
        "opened_reports": opened_reports,
        "handled_recap": handled_recap,
    }
    if user_agent:
        payload.update(parse_device_context(user_agent))
    if completed_tasks_count is not None:
        payload["completed_tasks_count"] = completed_tasks_count
    if completed_habits_count is not None:
        payload["completed_habits_count"] = completed_habits_count
    if main_tasks_total is not None:
        payload["main_tasks_total"] = main_tasks_total
    if main_tasks_completed is not None:
        payload["main_tasks_completed"] = main_tasks_completed
    if secondary_tasks_total is not None:
        payload["secondary_tasks_total"] = secondary_tasks_total
    if secondary_tasks_completed is not None:
        payload["secondary_tasks_completed"] = secondary_tasks_completed
    if habits_total is not None:
        payload["habits_total"] = habits_total
    if main_goal_completed is not None:
        payload["main_goal_completed"] = main_goal_completed
    if completed_any_meaningful_work is not None:
        payload["completed_any_meaningful_work"] = completed_any_meaningful_work
    if daily_completion_score is not None:
        payload["daily_completion_score"] = daily_completion_score
    row = _upsert_activity_payload(db, session, local_date, payload)
    auth_user_id = session.get("auth_user_id")
    device = parse_device_context(user_agent) if user_agent else {}
    if auth_user_id and device.get("device_type") and device.get("device_type") != "unknown":
        activity_db.upsert_user_device_activity(
            db,
            {
                "auth_user_id": auth_user_id,
                "session_id": str(session_id),
                "device_type": device["device_type"],
                "device_family": device["device_family"],
                "os_name": device["os_name"],
                "browser_name": device["browser_name"],
                "user_agent": device["user_agent"],
                "first_seen_at": now.isoformat(),
                "last_seen_at": now.isoformat(),
            },
        )
    return row


def _compute_daily_completion_metrics(priorities: list[dict], habit_logs: list[dict], habits_total: int) -> dict:
    main_tasks = [row for row in priorities if row.get("is_main")]
    secondary_tasks = [row for row in priorities if not row.get("is_main")]
    main_total = len(main_tasks)
    main_completed = sum(1 for row in main_tasks if row.get("completed"))
    secondary_total = len(secondary_tasks)
    secondary_completed = sum(1 for row in secondary_tasks if row.get("completed"))
    habits_completed = sum(1 for row in habit_logs if row.get("completed"))
    main_component = 100 if main_total > 0 and main_completed == main_total else 0
    secondary_component = int((secondary_completed / secondary_total) * 100) if secondary_total else 0
    habit_component = int((habits_completed / habits_total) * 100) if habits_total else 0
    daily_completion_score = round((main_component * 0.5) + (secondary_component * 0.25) + (habit_component * 0.25))
    return {
        "main_tasks_total": main_total,
        "main_tasks_completed": main_completed,
        "secondary_tasks_total": secondary_total,
        "secondary_tasks_completed": secondary_completed,
        "completed_tasks_count": main_completed + secondary_completed,
        "habits_total": habits_total,
        "completed_habits_count": habits_completed,
        "main_goal_completed": bool(main_total and main_completed == main_total),
        "completed_any_meaningful_work": bool(main_completed or secondary_completed or habits_completed),
        "daily_completion_score": daily_completion_score,
    }


def refresh_daily_completion_counts(db: Client, session_id: UUID, activity_date: date | None = None) -> dict | None:
    target_date = activity_date or get_session_today(db, session_id)
    priorities = plans_db.list_daily_priorities(db, session_id, target_date)
    habit_logs = habits_db.list_habit_logs_for_session(db, session_id, target_date, target_date)
    habits_total = len(habits_db.list_habits(db, session_id, active_only=True))
    metrics = _compute_daily_completion_metrics(priorities, habit_logs, habits_total)
    return record_activity(
        db,
        session_id,
        activity_date=target_date,
        **metrics,
    )


def track_app_open(db: Client, session_id: UUID, *, user_agent: str | None = None) -> dict | None:
    return record_activity(db, session_id, opened_app=True, user_agent=user_agent)


def track_onboarding_completed(db: Client, session_id: UUID) -> dict | None:
    return record_activity(db, session_id, completed_onboarding=True)


def track_created_yearly_goal(db: Client, session_id: UUID) -> dict | None:
    return record_activity(db, session_id, created_yearly_goal=True)


def track_created_monthly_goal(db: Client, session_id: UUID) -> dict | None:
    return record_activity(db, session_id, created_monthly_goal=True)


def track_created_weekly_goal(db: Client, session_id: UUID) -> dict | None:
    return record_activity(db, session_id, created_weekly_goal=True)


def track_created_daily_plan(db: Client, session_id: UUID, plan_date: date | None = None) -> dict | None:
    return record_activity(db, session_id, activity_date=plan_date, created_daily_plan=True)


def track_reached_dashboard(db: Client, session_id: UUID, *, user_agent: str | None = None) -> dict | None:
    return record_activity(db, session_id, reached_dashboard=True, opened_app=True, user_agent=user_agent)


def track_opened_next_day_review(db: Client, session_id: UUID, *, user_agent: str | None = None) -> dict | None:
    return record_activity(db, session_id, opened_next_day_review=True, user_agent=user_agent)


def track_approved_next_day_review(db: Client, session_id: UUID, plan_date: date | None = None) -> dict | None:
    return record_activity(
        db,
        session_id,
        activity_date=plan_date,
        approved_next_day_review=True,
        created_daily_plan=True,
    )


def track_opened_reports(db: Client, session_id: UUID, *, user_agent: str | None = None) -> dict | None:
    return record_activity(db, session_id, opened_reports=True, user_agent=user_agent)


def bootstrap_daily_user_activity(db: Client) -> int:
    sessions = [row for row in sessions_db.list_sessions(db, limit=None) if row.get("auth_user_id")]
    rows_by_key: dict[tuple[str, date], dict] = {}

    def add_patch(
        session: dict,
        day: date | None,
        *,
        timestamp: datetime | None = None,
        opened_app: bool = False,
        reached_dashboard: bool = False,
        created_yearly_goal: bool = False,
        created_monthly_goal: bool = False,
        created_weekly_goal: bool = False,
        created_daily_plan: bool = False,
        approved_next_day_review: bool = False,
        completed_tasks_inc: int = 0,
        completed_habits_inc: int = 0,
    ) -> None:
        if day is None:
            return
        key = (str(session["id"]), day)
        patch = rows_by_key.setdefault(
            key,
            {
                "session": session,
                "activity_date": day,
                "opened_app": False,
                "reached_dashboard": False,
                "created_yearly_goal": False,
                "created_monthly_goal": False,
                "created_weekly_goal": False,
                "created_daily_plan": False,
                "approved_next_day_review": False,
                "completed_tasks_count": 0,
                "completed_habits_count": 0,
                "first_seen_at": None,
                "last_seen_at": None,
            },
        )
        patch["opened_app"] = patch["opened_app"] or opened_app
        patch["reached_dashboard"] = patch["reached_dashboard"] or reached_dashboard
        patch["created_yearly_goal"] = patch["created_yearly_goal"] or created_yearly_goal
        patch["created_monthly_goal"] = patch["created_monthly_goal"] or created_monthly_goal
        patch["created_weekly_goal"] = patch["created_weekly_goal"] or created_weekly_goal
        patch["created_daily_plan"] = patch["created_daily_plan"] or created_daily_plan
        patch["approved_next_day_review"] = patch["approved_next_day_review"] or approved_next_day_review
        patch["completed_tasks_count"] += completed_tasks_inc
        patch["completed_habits_count"] += completed_habits_inc
        if timestamp:
            if patch["first_seen_at"] is None or timestamp < patch["first_seen_at"]:
                patch["first_seen_at"] = timestamp
            if patch["last_seen_at"] is None or timestamp > patch["last_seen_at"]:
                patch["last_seen_at"] = timestamp

    for session in sessions:
        session_id = str(session["id"])
        created_at = _coerce_dt(session.get("created_at"))
        add_patch(session, _coerce_date(created_at), timestamp=created_at, opened_app=True)

        yearly_goals = db.table("yearly_goals").select("created_at").eq("session_id", session_id).execute().data or []
        for row in yearly_goals:
            created = _coerce_dt(row.get("created_at"))
            add_patch(session, _coerce_date(created), timestamp=created, created_yearly_goal=True)

        monthly_goals = db.table("monthly_goals").select("created_at").eq("session_id", session_id).execute().data or []
        for row in monthly_goals:
            created = _coerce_dt(row.get("created_at"))
            add_patch(session, _coerce_date(created), timestamp=created, created_monthly_goal=True)

        weekly_goals = db.table("weekly_goals").select("created_at").eq("session_id", session_id).execute().data or []
        for row in weekly_goals:
            created = _coerce_dt(row.get("created_at"))
            add_patch(session, _coerce_date(created), timestamp=created, created_weekly_goal=True)

        daily_plans = db.table("daily_plans").select("date,created_at,approved_at").eq("session_id", session_id).execute().data or []
        for row in daily_plans:
            plan_day = _coerce_date(row.get("date"))
            stamp = _coerce_dt(row.get("approved_at")) or _coerce_dt(row.get("created_at"))
            add_patch(session, plan_day, timestamp=stamp, created_daily_plan=True, reached_dashboard=True)

        priorities = (
            db.table("daily_priorities")
            .select("date,completed,completed_at,notes")
            .eq("session_id", session_id)
            .execute()
            .data
            or []
        )
        for row in priorities:
            completed_day = _coerce_date(row.get("completed_at")) or (_coerce_date(row.get("date")) if row.get("completed") else None)
            completed_stamp = _coerce_dt(row.get("completed_at"))
            add_patch(
                session,
                completed_day,
                timestamp=completed_stamp,
                completed_tasks_inc=1 if row.get("completed") else 0,
            )
            if (row.get("notes") or "") == "Approved from next-day review":
                add_patch(session, _coerce_date(row.get("date")), approved_next_day_review=True)

        habit_logs = (
            db.table("habit_logs")
            .select("date,completed,completed_at")
            .eq("session_id", session_id)
            .execute()
            .data
            or []
        )
        for row in habit_logs:
            completed_day = _coerce_date(row.get("completed_at")) or (_coerce_date(row.get("date")) if row.get("completed") else None)
            completed_stamp = _coerce_dt(row.get("completed_at"))
            add_patch(
                session,
                completed_day,
                timestamp=completed_stamp,
                completed_habits_inc=1 if row.get("completed") else 0,
            )

    upserted = 0
    for patch in rows_by_key.values():
        session = patch.pop("session")
        activity_date = patch.pop("activity_date")
        if _upsert_activity_payload(db, session, activity_date, patch) is not None:
            upserted += 1
        refresh_daily_completion_counts(db, UUID(str(session["id"])), activity_date)
    return upserted


def list_daily_activity(
    db: Client,
    *,
    auth_user_id: str | None = None,
    session_id: UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int | None = 500,
) -> list[dict]:
    return activity_db.list_daily_activity(
        db,
        auth_user_id=auth_user_id,
        session_id=session_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )


def _count_matching_rows(
    db: Client,
    table: str,
    session_ids: list[str],
    *,
    completed_only: bool = False,
) -> int:
    total = 0
    for session_id in session_ids:
        query = db.table(table).select("id", count="exact", head=True).eq("session_id", session_id)
        if completed_only:
            query = query.eq("completed", True)
        result = query.execute()
        total += int(result.count or 0)
    return total


def _choose_primary_session(rows: list[dict]) -> dict:
    return max(rows, key=lambda row: (str(row.get("updated_at") or ""), str(row.get("created_at") or "")))


def _active_dates(rows: list[dict]) -> list[date]:
    dates: list[date] = []
    for row in rows:
        if any(
            (
                row.get("opened_app"),
                row.get("completed_onboarding"),
                row.get("created_yearly_goal"),
                row.get("created_monthly_goal"),
                row.get("created_weekly_goal"),
                row.get("created_daily_plan"),
                row.get("opened_next_day_review"),
                row.get("approved_next_day_review"),
                row.get("opened_reports"),
                row.get("handled_recap"),
                int(row.get("completed_tasks_count") or 0) > 0,
                int(row.get("completed_habits_count") or 0) > 0,
            )
        ):
            dates.append(date.fromisoformat(str(row["activity_date"])))
    return sorted(set(dates))


def _productive_dates(rows: list[dict]) -> list[date]:
    return sorted(
        {
            date.fromisoformat(str(row["activity_date"]))
            for row in rows
            if row.get("completed_any_meaningful_work")
            or bool(row.get("main_goal_completed"))
            or int(row.get("completed_tasks_count") or 0) > 0
            or int(row.get("completed_habits_count") or 0) > 0
        }
    )


def _merge_export_daily_rows(rows: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str], dict] = {}
    for row in rows:
        auth_user_id = str(row.get("auth_user_id") or "").strip()
        activity_date = str(row.get("activity_date") or "").strip()
        if not auth_user_id or not activity_date:
            continue
        key = (auth_user_id, activity_date)
        existing = grouped.get(key)
        if existing is None:
            grouped[key] = {
                **row,
                "session_id": row.get("session_id") or "",
            }
            continue

        existing["session_id"] = "|".join(
            sorted(
                {
                    *([value for value in str(existing.get("session_id") or "").split("|") if value]),
                    str(row.get("session_id") or ""),
                }
                - {""}
            )
        )
        for key_name in (
            "opened_app",
            "reached_dashboard",
            "completed_onboarding",
            "created_yearly_goal",
            "created_monthly_goal",
            "created_weekly_goal",
            "created_daily_plan",
            "opened_next_day_review",
            "approved_next_day_review",
            "opened_reports",
            "handled_recap",
            "main_goal_completed",
            "completed_any_meaningful_work",
        ):
            existing[key_name] = bool(existing.get(key_name)) or bool(row.get(key_name))
        for key_name in (
            "main_tasks_total",
            "main_tasks_completed",
            "secondary_tasks_total",
            "secondary_tasks_completed",
            "habits_total",
            "completed_tasks_count",
            "completed_habits_count",
        ):
            existing[key_name] = max(int(existing.get(key_name) or 0), int(row.get(key_name) or 0))
        existing["daily_completion_score"] = max(
            int(existing.get("daily_completion_score") or 0),
            int(row.get("daily_completion_score") or 0),
        )
        first_seen_existing = _coerce_dt(existing.get("first_seen_at"))
        first_seen_row = _coerce_dt(row.get("first_seen_at"))
        if first_seen_row and (first_seen_existing is None or first_seen_row < first_seen_existing):
            existing["first_seen_at"] = row.get("first_seen_at")
        last_seen_existing = _coerce_dt(existing.get("last_seen_at"))
        last_seen_row = _coerce_dt(row.get("last_seen_at"))
        if last_seen_row and (last_seen_existing is None or last_seen_row > last_seen_existing):
            existing["last_seen_at"] = row.get("last_seen_at")
        for key_name in ("device_type", "device_family", "os_name", "browser_name"):
            existing[key_name] = existing.get(key_name) or row.get(key_name)
    merged_rows = list(grouped.values())
    merged_rows.sort(key=lambda item: (str(item.get("activity_date") or ""), str(item.get("auth_user_id") or "")), reverse=True)
    return merged_rows


def _current_and_longest_streak(active_dates: list[date], today: date) -> tuple[int, int]:
    if not active_dates:
        return 0, 0
    unique_dates = sorted(set(active_dates))
    longest = 1
    current = 0
    run = 1
    for previous, current_day in zip(unique_dates, unique_dates[1:]):
        if current_day == previous + timedelta(days=1):
            run += 1
            longest = max(longest, run)
        else:
            run = 1
    if unique_dates[-1] not in {today, today - timedelta(days=1)}:
        return 0, longest
    current = 1
    expected = unique_dates[-1]
    for candidate in reversed(unique_dates[:-1]):
        if expected - candidate == timedelta(days=1):
            current += 1
            expected = candidate
        else:
            break
    return current, longest


def _days_since_last_seen(last_active: datetime | None, today: date) -> int | None:
    if not last_active:
        return None
    return (today - last_active.date()).days


def _first_row_date(rows: list[dict], predicate) -> date | None:
    matching_dates = [
        activity_date
        for row in rows
        if predicate(row) and (activity_date := _coerce_date(row.get("activity_date"))) is not None
    ]
    return min(matching_dates) if matching_dates else None


def _has_activity_after(active_dates: list[date], target_date: date | None) -> bool:
    if target_date is None:
        return False
    return any(activity_date > target_date for activity_date in active_dates)


def _derive_onboarding_stop_stage(primary_session: dict, rows: list[dict], active_dates: list[date]) -> str | None:
    onboarding_done = bool(primary_session.get("onboarding_done"))
    if onboarding_done:
        has_post_onboarding_signal = any(
            row.get("created_weekly_goal")
            or row.get("created_daily_plan")
            or row.get("opened_next_day_review")
            or row.get("approved_next_day_review")
            or row.get("opened_reports")
            or int(row.get("completed_tasks_count") or 0) > 0
            or int(row.get("completed_habits_count") or 0) > 0
            for row in rows
        )
        return "completed" if has_post_onboarding_signal else "dashboard"
    step = int(primary_session.get("onboarding_step") or 1)
    if active_dates:
        return _ONBOARDING_STAGE_BY_STEP.get(step, "yearly")
    return None


def _derive_retention_status(
    *,
    onboarding_completed: bool,
    days_since_last_seen: int | None,
    days_active_7d: int,
    days_active_30d: int,
    returned_day_7: bool,
    current_streak_days: int,
    total_tasks_completed: int,
    total_habits_completed: int,
) -> str:
    if days_since_last_seen is not None and days_since_last_seen >= 14:
        return "churned"
    if onboarding_completed and (current_streak_days >= 7 or days_active_30d >= 12):
        return "power_user"
    if onboarding_completed and (returned_day_7 or days_active_30d >= 4):
        return "retained"
    if onboarding_completed and days_active_7d >= 1:
        return "active"
    if onboarding_completed or total_tasks_completed > 0 or total_habits_completed > 0:
        return "activated"
    return "tester"


def _derive_retention_risk(days_since_last_seen: int | None, days_active_7d: int) -> str:
    if days_since_last_seen is None:
        return "high"
    if days_since_last_seen <= 2 and days_active_7d >= 3:
        return "low"
    if days_since_last_seen <= 7:
        return "medium"
    return "high"


def build_user_device_activity(db: Client) -> list[dict]:
    return [row for row in activity_db.list_user_device_activity(db, limit=None) if row.get("auth_user_id")]


def _category_name_for_monthly(monthly_goal: dict, yearly_map: dict[str, dict], category_map: dict[str, dict]) -> str | None:
    category_id = monthly_goal.get("category_id")
    if category_id and str(category_id) in category_map:
        return category_map[str(category_id)]["name"]
    yearly_goal_id = monthly_goal.get("yearly_goal_id")
    if yearly_goal_id and str(yearly_goal_id) in yearly_map:
        y_category_id = yearly_map[str(yearly_goal_id)].get("category_id")
        if y_category_id and str(y_category_id) in category_map:
            return category_map[str(y_category_id)]["name"]
    return None


def build_user_category_profiles(db: Client) -> tuple[list[dict], list[dict]]:
    auth_users = list_auth_users(db)
    auth_user_map = {str(user["id"]): user for user in auth_users if user.get("id")}
    sessions = [row for row in sessions_db.list_sessions(db, limit=None) if row.get("auth_user_id") in auth_user_map]
    profiles: list[dict] = []
    popularity: dict[str, dict] = {}
    grouped_sessions: dict[str, list[dict]] = defaultdict(list)
    for session in sessions:
        grouped_sessions[str(session["auth_user_id"])].append(session)

    for auth_user_id, session_rows in grouped_sessions.items():
        by_category: dict[str, dict] = {}
        for session in session_rows:
            session_id = str(session["id"])
            categories = db.table("categories").select("id,name").eq("session_id", session_id).execute().data or []
            category_map = {str(row["id"]): row for row in categories}
            yearly_goals = db.table("yearly_goals").select("id,category_id").eq("session_id", session_id).execute().data or []
            yearly_map = {str(row["id"]): row for row in yearly_goals}
            monthly_goals = db.table("monthly_goals").select("id,category_id,yearly_goal_id").eq("session_id", session_id).execute().data or []
            monthly_map = {str(row["id"]): row for row in monthly_goals}
            weekly_goals = db.table("weekly_goals").select("id,monthly_goal_id").eq("session_id", session_id).execute().data or []
            weekly_to_category: dict[str, str] = {}
            for row in weekly_goals:
                monthly_goal = monthly_map.get(str(row.get("monthly_goal_id")))
                if not monthly_goal:
                    continue
                category_name = _category_name_for_monthly(monthly_goal, yearly_map, category_map)
                if category_name:
                    weekly_to_category[str(row["id"])] = category_name

            daily_priorities = db.table("daily_priorities").select("weekly_goal_id").eq("session_id", session_id).execute().data or []
            habits = db.table("foundational_habits").select("category_id").eq("session_id", session_id).execute().data or []

            for category in categories:
                by_category.setdefault(
                    category["name"],
                    {
                        "auth_user_id": auth_user_id,
                        "auth_email": auth_user_map[auth_user_id].get("email"),
                        "category_id": category["id"],
                        "category_name": category["name"],
                        "yearly_goal_count": 0,
                        "monthly_goal_count": 0,
                        "weekly_goal_count": 0,
                        "daily_task_count": 0,
                        "habit_count": 0,
                        "total_items_count": 0,
                    },
                )

            for row in yearly_goals:
                category = category_map.get(str(row.get("category_id")))
                if category:
                    by_category[category["name"]]["yearly_goal_count"] += 1

            for row in monthly_goals:
                category_name = _category_name_for_monthly(row, yearly_map, category_map)
                if category_name and category_name in by_category:
                    by_category[category_name]["monthly_goal_count"] += 1

            for category_name in weekly_to_category.values():
                if category_name in by_category:
                    by_category[category_name]["weekly_goal_count"] += 1

            for row in daily_priorities:
                category_name = weekly_to_category.get(str(row.get("weekly_goal_id")))
                if category_name and category_name in by_category:
                    by_category[category_name]["daily_task_count"] += 1

            for row in habits:
                category = category_map.get(str(row.get("category_id")))
                if category and category["name"] in by_category:
                    by_category[category["name"]]["habit_count"] += 1

        for profile in by_category.values():
            profile["total_items_count"] = (
                profile["yearly_goal_count"]
                + profile["monthly_goal_count"]
                + profile["weekly_goal_count"]
                + profile["daily_task_count"]
                + profile["habit_count"]
            )
            profiles.append(profile)
            pop = popularity.setdefault(
                profile["category_name"],
                {
                    "category_name": profile["category_name"],
                    "users_count": 0,
                    "yearly_goal_count": 0,
                    "monthly_goal_count": 0,
                    "weekly_goal_count": 0,
                    "daily_task_count": 0,
                    "habit_count": 0,
                    "total_items_count": 0,
                },
            )
            pop["users_count"] += 1
            for key in ("yearly_goal_count", "monthly_goal_count", "weekly_goal_count", "daily_task_count", "habit_count", "total_items_count"):
                pop[key] += profile[key]

    profiles.sort(key=lambda item: (item["auth_email"] or "", item["total_items_count"], item["category_name"]), reverse=False)
    popularity_rows = sorted(popularity.values(), key=lambda item: (item["users_count"], item["total_items_count"]), reverse=True)
    return profiles, popularity_rows


def build_user_activity_summaries(db: Client, *, limit: int | None = None) -> list[dict]:
    auth_users = list_auth_users(db)
    auth_user_map = {str(user["id"]): user for user in auth_users if user.get("id")}
    sessions = [row for row in sessions_db.list_sessions(db, limit=None) if row.get("auth_user_id") in auth_user_map]
    grouped_sessions: dict[str, list[dict]] = defaultdict(list)
    for session in sessions:
        key = str(session["auth_user_id"])
        grouped_sessions[str(key)].append(session)

    activity_rows = [row for row in list_daily_activity(db, limit=None) if row.get("auth_user_id") in auth_user_map]
    grouped_activity: dict[str, list[dict]] = defaultdict(list)
    for row in activity_rows:
        key = str(row["auth_user_id"])
        grouped_activity[str(key)].append(row)

    today = date.today()
    summaries: list[dict] = []

    for user_key, auth_user in auth_user_map.items():
        session_rows = grouped_sessions.get(user_key, [])
        primary = _choose_primary_session(session_rows) if session_rows else None
        session_ids = [str(row["id"]) for row in session_rows]
        rows = grouped_activity.get(user_key, [])
        active_dates = _active_dates(rows)
        productive_dates = _productive_dates(rows)
        current_streak_days, longest_streak_days = _current_and_longest_streak(active_dates, today)

        signup_at = auth_user.get("created_at")
        signup_date = signup_at.date() if signup_at else None

        returned_day_1 = bool(signup_date and (signup_date + timedelta(days=1)) in active_dates)
        returned_day_3 = bool(signup_date and (signup_date + timedelta(days=3)) in active_dates)
        returned_day_7 = bool(signup_date and (signup_date + timedelta(days=7)) in active_dates)
        days_active_7d = sum(1 for day in active_dates if day >= today - timedelta(days=6))
        days_active_30d = sum(1 for day in active_dates if day >= today - timedelta(days=29))
        productive_days_7d = sum(1 for day in productive_dates if day >= today - timedelta(days=6))
        productive_days_30d = sum(1 for day in productive_dates if day >= today - timedelta(days=29))

        last_active_candidates: list[datetime] = []
        for session in session_rows:
            raw = session.get("last_active_at") or session.get("last_seen_at")
            if raw:
                dt = _coerce_dt(raw)
                if dt:
                    last_active_candidates.append(dt)
        for row in rows:
            raw = row.get("last_seen_at")
            if raw:
                dt = _coerce_dt(raw)
                if dt:
                    last_active_candidates.append(dt)
        last_active_at = max(last_active_candidates) if last_active_candidates else None
        first_active_at = None
        if rows:
            first_seen_values = [row.get("first_seen_at") for row in rows if row.get("first_seen_at")]
            if first_seen_values:
                first_seen_datetimes = [dt for value in first_seen_values if (dt := _coerce_dt(value)) is not None]
                if first_seen_datetimes:
                    first_active_at = min(first_seen_datetimes)

        total_tasks_completed = _count_matching_rows(db, "daily_priorities", session_ids, completed_only=True) if session_ids else 0
        total_habits_completed = _count_matching_rows(db, "habit_logs", session_ids, completed_only=True) if session_ids else 0
        created_yearly_goal_count = _count_matching_rows(db, "yearly_goals", session_ids) if session_ids else 0
        created_monthly_goal_count = _count_matching_rows(db, "monthly_goals", session_ids) if session_ids else 0
        created_weekly_goal_count = _count_matching_rows(db, "weekly_goals", session_ids) if session_ids else 0
        created_daily_plan_count = _count_matching_rows(db, "daily_plans", session_ids) if session_ids else 0

        days_since_last_seen = _days_since_last_seen(last_active_at, today)
        onboarding_started = bool(session_rows)
        onboarding_completed = any(bool(row.get("onboarding_done")) for row in session_rows)
        highest_step = max((int(row.get("onboarding_step") or 1) for row in session_rows), default=1)
        onboarding_session = {**(primary or {}), "onboarding_done": onboarding_completed, "onboarding_step": highest_step}
        device_rows = activity_db.list_user_device_activity(db, auth_user_id=user_key, limit=None)
        device_types_used = sorted({row.get("device_type") for row in device_rows if row.get("device_type")})
        primary_device_type = device_rows[0].get("device_type") if device_rows else None
        onboarding_completed_date = _first_row_date(rows, lambda row: bool(row.get("completed_onboarding")))
        first_review_date = _first_row_date(
            rows,
            lambda row: bool(row.get("opened_next_day_review") or row.get("approved_next_day_review")),
        )
        summary = {
            "user_key": user_key,
            "auth_user_id": user_key,
            "auth_email": auth_user.get("email"),
            "auth_name": auth_user.get("name"),
            "primary_session_id": primary["id"] if primary else None,
            "signup_at": signup_at,
            "first_active_at": first_active_at,
            "last_active_at": last_active_at,
            "primary_device_type": primary_device_type,
            "device_types_used": device_types_used,
            "onboarding_started": onboarding_started,
            "onboarding_completed": onboarding_completed,
            "onboarding_stop_stage": _derive_onboarding_stop_stage(onboarding_session, rows, active_dates),
            "reached_dashboard": any(bool(row.get("reached_dashboard")) for row in rows),
            "days_active_total": len(active_dates),
            "days_active_7d": days_active_7d,
            "days_active_30d": days_active_30d,
            "productive_days_7d": productive_days_7d,
            "productive_days_30d": productive_days_30d,
            "current_streak_days": current_streak_days,
            "longest_streak_days": longest_streak_days,
            "returned_day_1": returned_day_1,
            "returned_day_3": returned_day_3,
            "returned_day_7": returned_day_7,
            "created_yearly_goal_count": created_yearly_goal_count,
            "created_monthly_goal_count": created_monthly_goal_count,
            "created_weekly_goal_count": created_weekly_goal_count,
            "created_daily_plan_count": created_daily_plan_count,
            "completed_days_count": len(productive_dates),
            "main_goal_completion_days": sum(1 for row in rows if row.get("main_goal_completed")),
            "secondary_task_completion_days": sum(1 for row in rows if int(row.get("secondary_tasks_completed") or 0) > 0),
            "habit_completion_days": sum(1 for row in rows if int(row.get("completed_habits_count") or 0) > 0),
            "total_tasks_completed": total_tasks_completed,
            "total_habits_completed": total_habits_completed,
            "avg_daily_completion_score": round(sum(int(row.get("daily_completion_score") or 0) for row in rows) / len(rows)) if rows else 0,
            "used_next_day_review": any(
                row.get("opened_next_day_review") or row.get("approved_next_day_review")
                for row in rows
            ),
            "approved_next_day_review_count": sum(1 for row in rows if row.get("approved_next_day_review")),
            "opened_reports_count": sum(1 for row in rows if row.get("opened_reports")),
            "days_since_last_seen": days_since_last_seen,
            "active_dates": active_dates,
            "onboarding_completed_date": onboarding_completed_date,
            "first_review_date": first_review_date,
        }
        summary["retention_status"] = _derive_retention_status(
            onboarding_completed=onboarding_completed,
            days_since_last_seen=days_since_last_seen,
            days_active_7d=days_active_7d,
            days_active_30d=days_active_30d,
            returned_day_7=returned_day_7,
            current_streak_days=current_streak_days,
            total_tasks_completed=total_tasks_completed,
            total_habits_completed=total_habits_completed,
        )
        summary["retention_risk"] = _derive_retention_risk(days_since_last_seen, days_active_7d)
        summaries.append(summary)

    summaries.sort(
        key=lambda item: (
            item["last_active_at"] or datetime.min,
            item["signup_at"] or datetime.min,
        ),
        reverse=True,
    )
    if limit is not None:
        return summaries[:limit]
    return summaries


def get_user_activity_summary(db: Client, user_key: str) -> dict | None:
    for summary in build_user_activity_summaries(db, limit=None):
        if summary["user_key"] == user_key or summary.get("auth_user_id") == user_key:
            return summary
    return None


def build_user_lifecycle_rows(db: Client, *, limit: int | None = None) -> list[dict]:
    lifecycle_rows: list[dict] = []
    for item in build_user_activity_summaries(db, limit=limit):
        created_daily_plan = item["created_daily_plan_count"] > 0
        ticked_any_task = item["total_tasks_completed"] > 0
        completed_main_task = item["main_goal_completion_days"] > 0
        completed_secondary_task = item["secondary_task_completion_days"] > 0
        completed_habit = item["total_habits_completed"] > 0
        saw_review = bool(item["used_next_day_review"])
        planned_next_day = item["approved_next_day_review_count"] > 0
        lifecycle_rows.append(
            {
                "user_key": item["user_key"],
                "auth_user_id": item["auth_user_id"] or "",
                "auth_email": item["auth_email"] or "",
                "auth_name": item["auth_name"] or "",
                "signup_at": item["signup_at"],
                "last_active_at": item["last_active_at"],
                "primary_device_type": item["primary_device_type"] or "",
                "device_types_used": item["device_types_used"],
                "onboarding_started": item["onboarding_started"],
                "onboarding_completed": item["onboarding_completed"],
                "onboarding_dropoff_stage": item["onboarding_stop_stage"] or "",
                "reached_homepage": bool(item["reached_dashboard"]),
                "created_yearly_goal": item["created_yearly_goal_count"] > 0,
                "created_monthly_goal": item["created_monthly_goal_count"] > 0,
                "created_weekly_goal": item["created_weekly_goal_count"] > 0,
                "created_daily_plan": created_daily_plan,
                "planned_day": created_daily_plan,
                "ticked_any_task": ticked_any_task,
                "completed_main_task": completed_main_task,
                "completed_secondary_task": completed_secondary_task,
                "completed_habit": completed_habit,
                "saw_review": saw_review,
                "planned_next_day": planned_next_day,
                "returned_after_onboarding": _has_activity_after(item["active_dates"], item.get("onboarding_completed_date")),
                "returned_after_review": _has_activity_after(item["active_dates"], item.get("first_review_date")),
                "days_active_total": item["days_active_total"],
                "days_active_7d": item["days_active_7d"],
                "days_active_30d": item["days_active_30d"],
                "productive_days_7d": item["productive_days_7d"],
                "productive_days_30d": item["productive_days_30d"],
                "current_streak_days": item["current_streak_days"],
                "retention_status": item["retention_status"],
                "days_since_last_seen": item["days_since_last_seen"],
            }
        )
    return lifecycle_rows


def get_user_lifecycle_summary(db: Client, user_key: str) -> dict | None:
    for summary in build_user_lifecycle_rows(db, limit=None):
        if summary["user_key"] == user_key or summary.get("auth_user_id") == user_key:
            return summary
    return None


def _csv_text(rows: list[dict], fieldnames: list[str]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue()


def export_user_lifecycle_csv(db: Client) -> str:
    summaries = build_user_lifecycle_rows(db, limit=None)
    rows = []
    for item in summaries:
        rows.append(
            {
                "user_key": item["user_key"],
                "auth_user_id": item["auth_user_id"] or "",
                "auth_email": item["auth_email"] or "",
                "auth_name": item["auth_name"] or "",
                "signup_at": item["signup_at"].isoformat() if item["signup_at"] else "",
                "last_active_at": item["last_active_at"].isoformat() if item["last_active_at"] else "",
                "primary_device_type": item["primary_device_type"] or "",
                "device_types_used": "|".join(item["device_types_used"]),
                "onboarding_started": item["onboarding_started"],
                "onboarding_completed": item["onboarding_completed"],
                "onboarding_dropoff_stage": item["onboarding_dropoff_stage"] or "",
                "reached_homepage": item["reached_homepage"],
                "created_yearly_goal": item["created_yearly_goal"],
                "created_monthly_goal": item["created_monthly_goal"],
                "created_weekly_goal": item["created_weekly_goal"],
                "created_daily_plan": item["created_daily_plan"],
                "planned_day": item["planned_day"],
                "ticked_any_task": item["ticked_any_task"],
                "completed_main_task": item["completed_main_task"],
                "completed_secondary_task": item["completed_secondary_task"],
                "completed_habit": item["completed_habit"],
                "saw_review": item["saw_review"],
                "planned_next_day": item["planned_next_day"],
                "returned_after_onboarding": item["returned_after_onboarding"],
                "returned_after_review": item["returned_after_review"],
                "days_active_total": item["days_active_total"],
                "days_active_7d": item["days_active_7d"],
                "days_active_30d": item["days_active_30d"],
                "productive_days_7d": item["productive_days_7d"],
                "productive_days_30d": item["productive_days_30d"],
                "current_streak_days": item["current_streak_days"],
                "retention_status": item["retention_status"],
                "days_since_last_seen": item["days_since_last_seen"] if item["days_since_last_seen"] is not None else "",
            }
        )
    return _csv_text(
        rows,
        [
            "user_key",
            "auth_user_id",
            "auth_email",
            "auth_name",
            "signup_at",
            "last_active_at",
            "primary_device_type",
            "device_types_used",
            "onboarding_started",
            "onboarding_completed",
            "onboarding_dropoff_stage",
            "reached_homepage",
            "created_yearly_goal",
            "created_monthly_goal",
            "created_weekly_goal",
            "created_daily_plan",
            "planned_day",
            "ticked_any_task",
            "completed_main_task",
            "completed_secondary_task",
            "completed_habit",
            "saw_review",
            "planned_next_day",
            "returned_after_onboarding",
            "returned_after_review",
            "days_active_total",
            "days_active_7d",
            "days_active_30d",
            "productive_days_7d",
            "productive_days_30d",
            "current_streak_days",
            "retention_status",
            "days_since_last_seen",
        ],
    )


def export_user_summaries_csv(db: Client) -> str:
    return export_user_lifecycle_csv(db)


def export_daily_activity_csv(
    db: Client,
    *,
    auth_user_id: str | None = None,
    session_id: UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> str:
    auth_user_ids = {str(user["id"]) for user in list_auth_users(db) if user.get("id")}
    rows = [
        row
        for row in list_daily_activity(
            db,
            auth_user_id=auth_user_id,
            session_id=session_id,
            start_date=start_date,
            end_date=end_date,
            limit=None,
        )
        if row.get("auth_user_id") in auth_user_ids
    ]
    rows = _merge_export_daily_rows(rows)
    return _csv_text(
        rows,
        [
            "id",
            "session_id",
            "auth_user_id",
            "activity_date",
            "timezone",
            "first_seen_at",
            "last_seen_at",
            "opened_app",
            "reached_dashboard",
            "device_type",
            "device_family",
            "os_name",
            "browser_name",
            "completed_onboarding",
            "created_yearly_goal",
            "created_monthly_goal",
            "created_weekly_goal",
            "created_daily_plan",
            "opened_next_day_review",
            "approved_next_day_review",
            "opened_reports",
            "handled_recap",
            "main_tasks_total",
            "main_tasks_completed",
            "secondary_tasks_total",
            "secondary_tasks_completed",
            "habits_total",
            "completed_tasks_count",
            "completed_habits_count",
            "main_goal_completed",
            "completed_any_meaningful_work",
            "daily_completion_score",
            "created_at",
            "updated_at",
        ],
    )


def export_user_device_activity_csv(db: Client) -> str:
    rows = build_user_device_activity(db)
    return _csv_text(
        rows,
        [
            "auth_user_id",
            "session_id",
            "device_type",
            "device_family",
            "os_name",
            "browser_name",
            "user_agent",
            "first_seen_at",
            "last_seen_at",
            "created_at",
            "updated_at",
        ],
    )


def export_user_category_profiles_csv(db: Client) -> str:
    rows, _ = build_user_category_profiles(db)
    return _csv_text(
        rows,
        [
            "auth_user_id",
            "auth_email",
            "category_id",
            "category_name",
            "yearly_goal_count",
            "monthly_goal_count",
            "weekly_goal_count",
            "daily_task_count",
            "habit_count",
            "total_items_count",
        ],
    )


def export_category_popularity_csv(db: Client) -> str:
    _, rows = build_user_category_profiles(db)
    return _csv_text(
        rows,
        [
            "category_name",
            "users_count",
            "yearly_goal_count",
            "monthly_goal_count",
            "weekly_goal_count",
            "daily_task_count",
            "habit_count",
            "total_items_count",
        ],
    )
