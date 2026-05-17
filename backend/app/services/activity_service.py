from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from supabase import Client

import app.db.activity as activity_db
import app.db.plans as plans_db
import app.db.sessions as sessions_db
import app.db.yearly_goals as yearly_goals_db
from app.db import habits as habits_db
from app.schemas.activity import ActivityEvent
from app.utils.period_guards import get_session_now, get_session_temporal_context, get_session_today


_BOOLEAN_EVENT_FIELDS: dict[ActivityEvent, tuple[str, bool]] = {
    "app_opened": ("opened_app", False),
    "onboarding_completed": ("completed_onboarding", True),
    "yearly_goal_created": ("created_yearly_goal", True),
    "monthly_goal_created": ("created_monthly_goal", True),
    "weekly_goal_created": ("created_weekly_goal", True),
    "daily_plan_created": ("created_daily_plan", True),
    "next_day_review_opened": ("opened_next_day_review", True),
    "next_day_review_approved": ("approved_next_day_review", True),
    "reports_opened": ("opened_reports", True),
    "recap_handled": ("handled_recap", True),
}


def _normalize_auth_admin_user(raw_user: object) -> dict:
    if hasattr(raw_user, "model_dump"):
        data = raw_user.model_dump()
    elif hasattr(raw_user, "dict"):
        data = raw_user.dict()
    else:
        data = dict(raw_user)
    user_meta = data.get("user_metadata") or {}
    email = data.get("email")
    display_name = user_meta.get("full_name") or user_meta.get("name")
    if not display_name and email:
        display_name = str(email).split("@")[0]
    return {
        "id": data.get("id"),
        "email": email,
        "name": display_name,
    }


def _list_auth_users(db: Client) -> list[dict]:
    users: list[dict] = []
    page = 1
    while True:
        result = db.auth.admin.list_users(page=page, per_page=200)
        batch = getattr(result, "users", None) or getattr(result, "data", {}).get("users", [])
        if not batch:
            break
        users.extend(_normalize_auth_admin_user(user) for user in batch)
        if len(batch) < 200:
            break
        page += 1
    return [user for user in users if user.get("id")]


def _summary_sort_key(summary: dict) -> tuple[str, str]:
    return (
        str(summary.get("last_seen_at") or summary.get("last_active_at") or ""),
        str(summary.get("last_opened_date_local") or ""),
    )


def _session_context(db: Client, session_id: UUID) -> tuple[dict, date, datetime]:
    session = sessions_db.get_session(db, session_id) or {}
    return session, get_session_today(db, session_id), get_session_now(db, session_id)


def _presence_updates(
    seen_at: datetime,
    activity_date: date,
    *,
    mark_active: bool,
) -> dict:
    updates = {
        "last_seen_at": seen_at.isoformat(),
        "last_opened_date_local": activity_date.isoformat(),
    }
    if mark_active:
        updates["last_active_at"] = seen_at.isoformat()
    return updates


def _merge_activity_row(
    session_id: UUID,
    existing: dict | None,
    session: dict,
    activity_date: date,
    seen_at: datetime,
    updates: dict,
) -> dict:
    payload = {
        "session_id": str(session_id),
        "auth_user_id": session.get("auth_user_id"),
        "activity_date": activity_date.isoformat(),
        "timezone": session.get("timezone") or "UTC",
        "first_seen_at": (existing or {}).get("first_seen_at") or seen_at.isoformat(),
        "last_seen_at": seen_at.isoformat(),
        "opened_app": bool((existing or {}).get("opened_app")),
        "completed_onboarding": bool((existing or {}).get("completed_onboarding")),
        "created_yearly_goal": bool((existing or {}).get("created_yearly_goal")),
        "created_monthly_goal": bool((existing or {}).get("created_monthly_goal")),
        "created_weekly_goal": bool((existing or {}).get("created_weekly_goal")),
        "created_daily_plan": bool((existing or {}).get("created_daily_plan")),
        "opened_next_day_review": bool((existing or {}).get("opened_next_day_review")),
        "approved_next_day_review": bool((existing or {}).get("approved_next_day_review")),
        "opened_reports": bool((existing or {}).get("opened_reports")),
        "handled_recap": bool((existing or {}).get("handled_recap")),
        "completed_tasks_count": int((existing or {}).get("completed_tasks_count") or 0),
        "completed_habits_count": int((existing or {}).get("completed_habits_count") or 0),
    }
    for key, value in updates.items():
        if isinstance(value, bool):
            payload[key] = bool(payload.get(key)) or value
        else:
            payload[key] = value
    return payload


def mark_event(
    db: Client,
    session_id: UUID,
    event: ActivityEvent,
    *,
    activity_date: date | None = None,
) -> dict:
    session, session_today, seen_at = _session_context(db, session_id)
    effective_date = activity_date or session_today
    existing = activity_db.get_daily_activity(db, session_id, effective_date)
    field_name, mark_active = _BOOLEAN_EVENT_FIELDS[event]
    payload = _merge_activity_row(
        session_id,
        existing,
        session,
        effective_date,
        seen_at,
        {field_name: True, "opened_app": True},
    )
    record = activity_db.upsert_daily_activity(db, payload)
    sessions_db.update_session(
        db,
        session_id,
        _presence_updates(seen_at, effective_date, mark_active=mark_active),
    )
    return record


def touch_app_open(db: Client, session_id: UUID, *, activity_date: date | None = None) -> dict:
    return mark_event(db, session_id, "app_opened", activity_date=activity_date)


def sync_daily_execution_counts(
    db: Client,
    session_id: UUID,
    *,
    activity_date: date | None = None,
) -> dict:
    session, session_today, seen_at = _session_context(db, session_id)
    effective_date = activity_date or session_today
    priorities = plans_db.list_daily_priorities(db, session_id, effective_date)
    habit_logs = habits_db.list_habit_logs_for_session(db, session_id, effective_date, effective_date)
    existing = activity_db.get_daily_activity(db, session_id, effective_date)
    payload = _merge_activity_row(
        session_id,
        existing,
        session,
        effective_date,
        seen_at,
        {
            "opened_app": True,
            "completed_tasks_count": sum(1 for item in priorities if item.get("completed")),
            "completed_habits_count": sum(1 for item in habit_logs if item.get("completed")),
        },
    )
    record = activity_db.upsert_daily_activity(db, payload)
    sessions_db.update_session(
        db,
        session_id,
        _presence_updates(seen_at, effective_date, mark_active=True),
    )
    return record


def get_onboarding_evidence(db: Client, session_id: UUID) -> dict:
    ctx = get_session_temporal_context(db, session_id)
    daily_plan = plans_db.get_daily_plan(db, session_id, ctx.today)
    daily_priorities = plans_db.list_daily_priorities(db, session_id, ctx.today)
    has_yearly_goals = bool(yearly_goals_db.list_yearly_goals(db, session_id, ctx.current_year))
    has_monthly_goals = bool(plans_db.list_monthly_goals(db, session_id, ctx.current_year, ctx.current_month))
    has_weekly_goals = bool(plans_db.list_weekly_goals(db, session_id, ctx.current_year, ctx.current_week_number))
    has_daily_plan = bool(daily_plan or daily_priorities)
    return {
        "has_yearly_goals": has_yearly_goals,
        "has_monthly_goals": has_monthly_goals,
        "has_weekly_goals": has_weekly_goals,
        "has_daily_plan": has_daily_plan,
        "complete": has_yearly_goals and has_monthly_goals and has_weekly_goals and has_daily_plan,
    }


def _derive_stage(
    session: dict | None,
    evidence: dict,
    recent_days: list[dict],
    session_today: date,
) -> tuple[str, int | None]:
    last_seen_raw = (session or {}).get("last_opened_date_local")
    if last_seen_raw:
        last_seen_date = date.fromisoformat(str(last_seen_raw))
        days_since_last_seen = (session_today - last_seen_date).days
    else:
        days_since_last_seen = None

    if days_since_last_seen is not None and days_since_last_seen >= 2:
        return "inactive", days_since_last_seen

    if not (session or {}).get("onboarding_done"):
        return "onboarding", days_since_last_seen

    today_activity = next(
        (entry for entry in recent_days if str(entry.get("activity_date")) == session_today.isoformat()),
        None,
    )
    if today_activity and (
        today_activity.get("approved_next_day_review") or today_activity.get("handled_recap")
    ):
        return "reviewing", days_since_last_seen
    if today_activity and (
        int(today_activity.get("completed_tasks_count") or 0) > 0
        or int(today_activity.get("completed_habits_count") or 0) > 0
    ):
        return "executing", days_since_last_seen
    if evidence.get("has_daily_plan"):
        return "daily_planning", days_since_last_seen
    return "planning_foundation", days_since_last_seen


def get_activity_overview(db: Client, session_id: UUID, *, days: int = 30) -> dict:
    session = sessions_db.get_session(db, session_id) or {}
    session_today = get_session_today(db, session_id)
    recent_days = activity_db.list_daily_activity(db, session_id, limit=max(1, min(days, 90)))
    evidence = get_onboarding_evidence(db, session_id)
    stage, days_since_last_seen = _derive_stage(session, evidence, recent_days, session_today)
    return {
        "session_id": str(session_id),
        "auth_user_id": session.get("auth_user_id"),
        "auth_name": session.get("auth_name"),
        "auth_email": session.get("auth_email"),
        "last_seen_at": session.get("last_seen_at"),
        "last_active_at": session.get("last_active_at"),
        "last_opened_date_local": session.get("last_opened_date_local"),
        "current_stage": stage,
        "days_since_last_seen": days_since_last_seen,
        "onboarding_evidence": evidence,
        "recent_days": recent_days,
    }


def _summarize_workspace(
    db: Client,
    session: dict,
    *,
    days: int,
) -> dict:
    session_id = UUID(str(session["id"]))
    session_today = get_session_today(db, session_id)
    recent_days = activity_db.list_daily_activity(db, session_id, limit=max(1, min(days, 90)))
    evidence = get_onboarding_evidence(db, session_id)
    stage, days_since_last_seen = _derive_stage(session, evidence, recent_days, session_today)
    active_days = len(recent_days)
    tasks_completed = sum(int(row.get("completed_tasks_count") or 0) for row in recent_days)
    habits_completed = sum(int(row.get("completed_habits_count") or 0) for row in recent_days)
    reports_opened = sum(1 for row in recent_days if row.get("opened_reports"))

    return {
        "session_id": str(session_id),
        "auth_user_id": session.get("auth_user_id"),
        "auth_name": session.get("auth_name"),
        "auth_email": session.get("auth_email"),
        "device_hint": session.get("device_hint"),
        "timezone": session.get("timezone") or "UTC",
        "onboarding_done": bool(session.get("onboarding_done")),
        "current_stage": stage,
        "days_since_last_seen": days_since_last_seen,
        "last_seen_at": session.get("last_seen_at"),
        "last_active_at": session.get("last_active_at"),
        "last_opened_date_local": session.get("last_opened_date_local"),
        "onboarding_evidence_complete": bool(evidence.get("complete")),
        "active_days_in_range": active_days,
        "absent_days_in_range": max(days - active_days, 0),
        "tasks_completed_in_range": tasks_completed,
        "habits_completed_in_range": habits_completed,
        "reports_opened_in_range": reports_opened,
    }


def get_admin_activity_overview(
    db: Client,
    *,
    days: int = 14,
    limit: int = 50,
) -> dict:
    effective_days = max(1, min(days, 90))
    effective_limit = max(1, min(limit, 200))
    auth_users = _list_auth_users(db)
    auth_user_map = {str(user["id"]): user for user in auth_users if user.get("id")}
    sessions = [
        session
        for session in sessions_db.list_sessions(db, limit=None)
        if session.get("auth_user_id") and str(session.get("auth_user_id")) in auth_user_map
    ]
    all_session_summaries = []
    for session in sessions:
        summary = _summarize_workspace(db, session, days=effective_days)
        auth_identity = auth_user_map.get(str(summary.get("auth_user_id"))) or {}
        summary["auth_email"] = auth_identity.get("email") or summary.get("auth_email")
        summary["auth_name"] = auth_identity.get("name") or summary.get("auth_name")
        all_session_summaries.append(summary)

    unique_users: dict[str, dict] = {}
    for summary in all_session_summaries:
        auth_user_id = str(summary.get("auth_user_id"))
        current = unique_users.get(auth_user_id)
        if current is None or _summary_sort_key(summary) > _summary_sort_key(current):
            unique_users[auth_user_id] = summary

    all_workspaces = list(unique_users.values())
    all_workspaces.sort(key=_summary_sort_key, reverse=True)
    workspaces = all_workspaces[:effective_limit]
    completed_onboarding = sum(
        1 for item in all_workspaces if item.get("onboarding_done") and item.get("onboarding_evidence_complete")
    )
    total_signed_up = len(all_workspaces)
    dropped_recently = sum(1 for item in all_workspaces if item.get("current_stage") == "inactive")

    return {
        "total_users": len(auth_users),
        "total_signed_up": total_signed_up,
        "completed_onboarding": completed_onboarding,
        "total_workspaces": len(all_session_summaries),
        "active_today": sum(1 for item in all_workspaces if item.get("days_since_last_seen") == 0),
        "onboarding_incomplete": max(len(all_workspaces) - completed_onboarding, 0),
        "inactive": dropped_recently,
        "dropped_recently": dropped_recently,
        "executing_now": sum(1 for item in all_workspaces if item.get("current_stage") == "executing"),
        "reviewing_now": sum(1 for item in all_workspaces if item.get("current_stage") == "reviewing"),
        "workspaces": workspaces,
    }
