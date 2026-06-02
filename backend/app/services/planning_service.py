"""
Planning service — orchestrates the yearly → monthly → weekly → daily generation flow.

This service:
1. Computes temporal context (code)
2. Builds planning payload (code)
3. Calls AI service for generation (AI)
4. Persists results (Supabase)
5. Returns structured response

The AI layer is isolated. Everything else is deterministic.
"""
import calendar
import uuid
from datetime import date, datetime, timezone
from uuid import UUID

from supabase import Client

from app.core.exceptions import NotFoundError, ConflictError, PlanLockedError
from app.core.logging import logger
from app.utils.date_utils import get_temporal_context, get_week_boundaries, week_number_for
from app.utils.planning_logic import (
    build_monthly_planning_payload,
    build_weekly_planning_payload,
    build_daily_planning_payload,
)
from app.services import ai_service
import app.db.plans as plans_db
import app.db.yearly_goals as yg_db
import app.db.categories as cat_db
import app.db.habits as habits_db
import app.db.reports as reports_db
import app.db.sessions as sessions_db

MAIN_GOAL_CAP = 3


def _month_last_date(year: int, month: int) -> date:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, last_day)


def _row_matches_draft(title: str, draft_items: list[dict]) -> bool:
    """Return True if the submitted title closely matches any item in the AI draft."""
    if not title or not draft_items:
        return False
    title_l = title.strip().lower()
    for item in draft_items:
        draft_title = (item.get("title") or "").strip().lower()
        if draft_title and (draft_title == title_l or draft_title in title_l or title_l in draft_title):
            return True
    return False


def _normalize_monthly_target_date(raw: object | None, year: int, month: int) -> str:
    """Return YYYY-MM-DD inside the given month; default last day of month."""
    fallback = _month_last_date(year, month).isoformat()
    if raw is None or raw == "":
        return fallback
    try:
        d = date.fromisoformat(str(raw).strip()[:10])
    except ValueError:
        return fallback
    if d.year != year or d.month != month:
        return fallback
    return d.isoformat()


def _cap_ai_plan_items(
    ai_output,
    *,
    main_field: str,
    secondary_field: str,
    max_main: int,
    max_secondary: int,
):
    return ai_output.model_copy(
        update={
            main_field: list(getattr(ai_output, main_field, [])[:max_main]),
            secondary_field: list(getattr(ai_output, secondary_field, [])[:max_secondary]),
        }
    )


def _match_yearly_goal_by_ref(ref: str | None, yearly_goals: list[dict]) -> dict | None:
    if not ref or not yearly_goals:
        return None
    ref_l = ref.strip().lower()
    if not ref_l:
        return None
    for g in yearly_goals:
        title = (g.get("title") or "").strip().lower()
        if title and title == ref_l:
            return g
    for g in yearly_goals:
        title = (g.get("title") or "").strip().lower()
        if title and (ref_l in title or title in ref_l):
            return g
    return None


def _match_monthly_goal_by_ref(ref: str | None, monthly_goals: list[dict]) -> dict | None:
    """Match AI monthly_goal_ref (or legacy yearly_goal_ref fallback) to a monthly goal row."""
    if not ref or not monthly_goals:
        return None
    ref_l = ref.strip().lower()
    if not ref_l:
        return None
    for g in monthly_goals:
        title = (g.get("title") or "").strip().lower()
        if title and title == ref_l:
            return g
    for g in monthly_goals:
        title = (g.get("title") or "").strip().lower()
        if title and (ref_l in title or title in ref_l):
            return g
    return None


def _match_weekly_goal_by_ref(ref: str | None, weekly_goals: list[dict]) -> dict | None:
    """Match AI parent ref text to a weekly goal row."""
    if not ref or not weekly_goals:
        return None
    ref_l = ref.strip().lower()
    if not ref_l:
        return None
    for g in weekly_goals:
        title = (g.get("title") or "").strip().lower()
        if title and title == ref_l:
            return g
    for g in weekly_goals:
        title = (g.get("title") or "").strip().lower()
        if title and (ref_l in title or title in ref_l):
            return g
    return None


def _linked_id_from_item(item: dict, key: str, allowed_rows: list[dict]) -> str | None:
    raw = item.get(key)
    if not raw:
        return None
    try:
        value = str(uuid.UUID(str(raw)))
    except (TypeError, ValueError):
        return None
    return value if any(str(row.get("id")) == value for row in allowed_rows) else None


def _normalize_ref_title(
    ref: str | None,
    rows: list[dict],
    matcher,
    *,
    single_parent_only: bool = False,
) -> str | None:
    if ref:
        matched = matcher(ref, rows)
        if matched:
            return matched.get("title")
    if single_parent_only and len(rows) == 1:
        title = rows[0].get("title")
        return str(title) if title else None
    main_rows = [row for row in rows if row.get("is_main")]
    if single_parent_only and len(main_rows) == 1:
        title = main_rows[0].get("title")
        return str(title) if title else None
    return None


def _normalize_monthly_ai_output(ai_output, yearly_goals: list[dict]):
    def normalize_item(item: dict) -> dict:
        yearly_title = _normalize_ref_title(
            item.get("yearly_goal_ref"),
            yearly_goals,
            _match_yearly_goal_by_ref,
            single_parent_only=True,
        )
        return {
            **item,
            "yearly_goal_ref": yearly_title,
            "monthly_goal_ref": None,
            "weekly_goal_ref": None,
        }

    return ai_output.model_copy(
        update={
            "main_goals": [normalize_item(item.model_dump() if hasattr(item, "model_dump") else item) for item in ai_output.main_goals],
            "secondary_goals": [normalize_item(item.model_dump() if hasattr(item, "model_dump") else item) for item in ai_output.secondary_goals],
        }
    )


def _normalize_weekly_ai_output(ai_output, monthly_goals: list[dict], yearly_goals: list[dict]):
    yearly_by_id = {str(goal.get("id")): goal for goal in yearly_goals if goal.get("id")}

    def normalize_item(item: dict) -> dict:
        monthly_row = _match_monthly_goal_by_ref(item.get("monthly_goal_ref"), monthly_goals)
        if not monthly_row:
            monthly_row = _match_monthly_goal_by_ref(item.get("yearly_goal_ref"), monthly_goals)
        if not monthly_row:
            monthly_title = _normalize_ref_title(None, monthly_goals, _match_monthly_goal_by_ref, single_parent_only=True)
            monthly_row = _match_monthly_goal_by_ref(monthly_title, monthly_goals) if monthly_title else None
        monthly_title = monthly_row.get("title") if monthly_row else None
        yearly_title = item.get("yearly_goal_ref")
        if monthly_row and monthly_row.get("yearly_goal_id"):
            parent_yearly = yearly_by_id.get(str(monthly_row.get("yearly_goal_id")))
            if parent_yearly:
                yearly_title = parent_yearly.get("title")
        else:
            yearly_title = _normalize_ref_title(yearly_title, yearly_goals, _match_yearly_goal_by_ref)
        return {
            **item,
            "monthly_goal_ref": monthly_title,
            "yearly_goal_ref": yearly_title,
            "weekly_goal_ref": None,
        }

    return ai_output.model_copy(
        update={
            "main_goals": [normalize_item(item.model_dump() if hasattr(item, "model_dump") else item) for item in ai_output.main_goals],
            "secondary_goals": [normalize_item(item.model_dump() if hasattr(item, "model_dump") else item) for item in ai_output.secondary_goals],
        }
    )


def _normalize_daily_ai_output(ai_output, weekly_goals: list[dict], monthly_goals: list[dict], yearly_goals: list[dict]):
    monthly_by_id = {str(goal.get("id")): goal for goal in monthly_goals if goal.get("id")}
    yearly_by_id = {str(goal.get("id")): goal for goal in yearly_goals if goal.get("id")}

    def normalize_item(item: dict) -> dict:
        weekly_row = _match_weekly_goal_by_ref(item.get("weekly_goal_ref"), weekly_goals)
        if not weekly_row:
            weekly_row = _match_weekly_goal_by_ref(item.get("monthly_goal_ref"), weekly_goals)
        if not weekly_row:
            weekly_row = _match_weekly_goal_by_ref(item.get("yearly_goal_ref"), weekly_goals)
        if not weekly_row:
            weekly_title = _normalize_ref_title(None, weekly_goals, _match_weekly_goal_by_ref, single_parent_only=True)
            weekly_row = _match_weekly_goal_by_ref(weekly_title, weekly_goals) if weekly_title else None

        weekly_title = weekly_row.get("title") if weekly_row else None
        monthly_title = item.get("monthly_goal_ref")
        yearly_title = item.get("yearly_goal_ref")
        if weekly_row and weekly_row.get("monthly_goal_id"):
            monthly_row = monthly_by_id.get(str(weekly_row.get("monthly_goal_id")))
            if monthly_row:
                monthly_title = monthly_row.get("title")
                if monthly_row.get("yearly_goal_id"):
                    yearly_row = yearly_by_id.get(str(monthly_row.get("yearly_goal_id")))
                    if yearly_row:
                        yearly_title = yearly_row.get("title")
        return {
            **item,
            "weekly_goal_ref": weekly_title,
            "monthly_goal_ref": monthly_title,
            "yearly_goal_ref": yearly_title,
        }

    return ai_output.model_copy(
        update={
            "top_priorities": [normalize_item(item.model_dump() if hasattr(item, "model_dump") else item) for item in ai_output.top_priorities],
            "secondary_tasks": [normalize_item(item.model_dump() if hasattr(item, "model_dump") else item) for item in ai_output.secondary_tasks],
        }
    )
def _single_main_goal(rows: list[dict]) -> dict | None:
    mains = [row for row in rows if row.get("is_main")]
    if len(mains) == 1:
        return mains[0]
    return None


def _count_main_rows(rows: list[dict]) -> int:
    return sum(1 for row in rows if row.get("is_main"))


def _assert_main_goal_cap(total_main: int, period_label: str, item_label: str) -> None:
    if total_main > MAIN_GOAL_CAP:
        raise ConflictError(
            f"You can only save up to {MAIN_GOAL_CAP} main {item_label} for this {period_label}."
        )


# ─── Monthly Plan ─────────────────────────────────────────────────────────────

def generate_monthly_plan(
    db: Client,
    session_id: UUID,
    year: int,
    month: int,
) -> dict:
    """
    Generate a monthly plan for the given year/month using AI.
    Stores the AI draft. Does NOT approve automatically.
    """
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_temporal_context(week_starts_on=week_starts_on)

    # Fetch parent data
    yearly_goals = yg_db.list_yearly_goals(db, session_id, year)
    categories = cat_db.list_categories(db, session_id)

    if not yearly_goals:
        raise NotFoundError("Yearly goals", "none found — complete yearly setup first")

    days_in_month = calendar.monthrange(year, month)[1]

    # Use current date if same month, else full month
    if year == ctx.current_year and month == ctx.current_month:
        days_remaining = ctx.days_remaining_in_month
    else:
        days_remaining = days_in_month

    # Build planning payload (deterministic)
    existing = plans_db.list_monthly_goals(db, session_id, year, month)
    payload = build_monthly_planning_payload(
        ctx=ctx,
        yearly_goals=yearly_goals,
        categories=categories,
        existing_monthly_goals=existing,
    )

    # Override temporal context with the actual month requested
    payload["temporal_context"]["month"] = month
    payload["temporal_context"]["year"] = year
    payload["temporal_context"]["days_remaining"] = days_remaining
    payload["temporal_context"]["days_in_month"] = days_in_month

    # Call AI
    start = datetime.now(timezone.utc)
    ai_output = ai_service.generate_monthly_plan(payload)
    ai_output = _cap_ai_plan_items(
        ai_output,
        main_field="main_goals",
        secondary_field="secondary_goals",
        max_main=payload["workload_budget"]["max_main_goals"],
        max_secondary=payload["workload_budget"]["max_secondary_goals"],
    )
    ai_output = _normalize_monthly_ai_output(ai_output, yearly_goals)
    latency_ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)

    # Log generation
    _log_generation(db, session_id, "monthly_plan", latency_ms=latency_ms)

    # Persist plan record with AI draft
    plan = plans_db.upsert_monthly_plan(db, session_id, {
        "year": year,
        "month": month,
        "status": "draft",
        "days_in_month": days_in_month,
        "days_remaining": days_remaining,
        "ai_draft": ai_output.model_dump(),
        "ai_generated_at": datetime.now(timezone.utc).isoformat(),
    })

    logger.info("monthly_plan_generated", session_id=str(session_id), month=month, year=year)
    return plan


def approve_monthly_plan(
    db: Client,
    session_id: UUID,
    year: int,
    month: int,
    custom_goals: list[dict] | None = None,
) -> dict:
    """
    Approve a monthly plan draft.
    Creates monthly_goal records from the AI draft (or custom goals if provided).
    """
    plan = plans_db.get_monthly_plan(db, session_id, year, month)
    if not plan:
        raise NotFoundError("Monthly plan", f"{year}-{month:02d}")

    if plan["status"] == "locked":
        raise PlanLockedError("Monthly plan")

    plan_id = plan["id"]

    # Clear existing goals for this plan (re-approval)
    plans_db.delete_monthly_goals_for_plan(db, UUID(plan_id))

    # Use custom goals or AI draft
    if custom_goals:
        goals_to_create = custom_goals
    else:
        draft = plan.get("ai_draft") or {}
        main_goals = draft.get("main_goals", [])
        secondary_goals = draft.get("secondary_goals", [])
        goals_to_create = [
            {**g, "is_main": True, "priority": "high"} for g in main_goals
        ] + [
            {**g, "is_main": False, "priority": g.get("priority", "medium")}
            for g in secondary_goals
        ]

    _assert_main_goal_cap(_count_main_rows(goals_to_create), "month", "goals")

    yearly_list = yg_db.list_yearly_goals(db, session_id, year)
    single_yearly_goal = yearly_list[0] if len(yearly_list) == 1 else None

    # Determine which draft items exist for per-row ai_suggested flagging
    plan_draft = plan.get("ai_draft") or {}
    all_draft_items = plan_draft.get("main_goals", []) + plan_draft.get("secondary_goals", [])

    # Map and insert goals
    goal_records = []
    for g in goals_to_create:
        yid = _linked_id_from_item(g, "yearly_goal_id", yearly_list)
        yg = next((row for row in yearly_list if str(row.get("id")) == yid), None) if yid else None
        if not yg:
            yg = _match_yearly_goal_by_ref(g.get("yearly_goal_ref"), yearly_list)
        if not yg and g.get("is_main") and single_yearly_goal:
            yg = single_yearly_goal
        yid = yg.get("id") if yg else yid
        cid = g.get("category_id") or (yg.get("category_id") if yg else None)
        target_date = _normalize_monthly_target_date(g.get("target_date"), year, month)
        is_ai_suggested = _row_matches_draft(g.get("title", ""), all_draft_items)
        goal_records.append({
            "session_id": str(session_id),
            "monthly_plan_id": plan_id,
            "title": g["title"],
            "description": g.get("description"),
            "year": year,
            "month": month,
            "status": "active",
            "progress": 0,
            "priority": g.get("priority", "medium"),
            "is_main": g.get("is_main", False),
            "ai_suggested": is_ai_suggested,
            "yearly_goal_id": str(yid) if yid else None,
            "category_id": str(cid) if cid else None,
            "target_date": target_date,
            "workload": g.get("estimated_effort"),
        })

    if goal_records:
        plans_db.bulk_create_monthly_goals(db, goal_records)

    updated_plan = plans_db.update_monthly_plan(db, UUID(plan_id), {
        "status": "active",
        "approved_at": datetime.now(timezone.utc).isoformat(),
    })

    logger.info("monthly_plan_approved", session_id=str(session_id), month=month)
    return updated_plan


# ─── Weekly Plan ──────────────────────────────────────────────────────────────

def generate_weekly_plan(
    db: Client,
    session_id: UUID,
    year: int,
    week_number: int,
) -> dict:
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_temporal_context(week_starts_on=week_starts_on)
    week_start, week_end = get_week_boundaries(year, week_number, week_starts_on)
    month = week_start.month

    days_remaining = ctx.days_remaining_in_week if (
        year == ctx.current_year and week_number == ctx.current_week_number
    ) else 7

    # Fetch approved monthly goals
    monthly_goals = plans_db.list_monthly_goals(db, session_id, year, month)
    if not monthly_goals:
        raise NotFoundError("Monthly goals", f"approve a monthly plan for {year}-{month:02d} first")

    yearly_goals = yg_db.list_yearly_goals(db, session_id, year)
    existing = plans_db.list_weekly_goals(db, session_id, year, week_number)

    # Override temporal context for the specific week
    from app.utils.date_utils import TemporalContext
    from datetime import timedelta
    week_ctx = TemporalContext(
        today=week_start,
        week_starts_on=week_starts_on,
        current_year=year,
        current_month=month,
        current_week_number=week_number,
        week_start=week_start,
        week_end=week_end,
        days_in_month=calendar.monthrange(year, month)[1],
        day_of_month=week_start.day,
        days_remaining_in_month=calendar.monthrange(year, month)[1] - week_start.day + 1,
        days_remaining_in_week=days_remaining,
        month_progress_pct=int(((week_start.day - 1) / calendar.monthrange(year, month)[1]) * 100),
        week_progress_pct=0,
        is_late_in_month=(calendar.monthrange(year, month)[1] - week_start.day + 1) <= 7,
        is_late_in_week=days_remaining <= 2,
    )

    payload = build_weekly_planning_payload(
        ctx=week_ctx,
        monthly_goals=monthly_goals,
        yearly_goals=yearly_goals,
        existing_weekly_goals=existing,
    )

    start = datetime.now(timezone.utc)
    ai_output = ai_service.generate_weekly_plan(payload)
    ai_output = _cap_ai_plan_items(
        ai_output,
        main_field="main_goals",
        secondary_field="secondary_goals",
        max_main=payload["workload_budget"]["max_main_goals"],
        max_secondary=payload["workload_budget"]["max_secondary_goals"],
    )
    ai_output = _normalize_weekly_ai_output(ai_output, monthly_goals, yearly_goals)
    latency_ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
    _log_generation(db, session_id, "weekly_plan", latency_ms=latency_ms)

    plan = plans_db.upsert_weekly_plan(db, session_id, {
        "year": year,
        "month": month,
        "week_number": week_number,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "status": "draft",
        "days_remaining": days_remaining,
        "ai_draft": ai_output.model_dump(),
        "ai_generated_at": datetime.now(timezone.utc).isoformat(),
    })

    logger.info("weekly_plan_generated", session_id=str(session_id), week=week_number, year=year)
    return plan


def approve_weekly_plan(
    db: Client,
    session_id: UUID,
    year: int,
    week_number: int,
    custom_goals: list[dict] | None = None,
) -> dict:
    plan = plans_db.get_weekly_plan(db, session_id, year, week_number)
    if not plan:
        raise NotFoundError("Weekly plan", f"week {week_number} {year}")

    if plan["status"] == "locked":
        raise PlanLockedError("Weekly plan")

    plan_id = plan["id"]
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    week_start, _ = get_week_boundaries(year, week_number, week_starts_on)
    month = week_start.month

    plans_db.delete_weekly_goals_for_plan(db, UUID(plan_id))

    if custom_goals:
        goals_to_create = custom_goals
    else:
        draft = plan.get("ai_draft") or {}
        goals_to_create = [
            {**g, "is_main": True} for g in draft.get("main_goals", [])
        ] + [
            {**g, "is_main": False} for g in draft.get("secondary_goals", [])
        ]

    _assert_main_goal_cap(_count_main_rows(goals_to_create), "week", "goals")

    monthly_list = plans_db.list_monthly_goals(db, session_id, year, month)
    single_main_monthly = _single_main_goal(monthly_list)

    # Per-row ai_suggested: compare against draft
    plan_draft = plan.get("ai_draft") or {}
    all_draft_items = plan_draft.get("main_goals", []) + plan_draft.get("secondary_goals", [])

    goal_records = []
    for g in goals_to_create:
        mid = _linked_id_from_item(g, "monthly_goal_id", monthly_list)
        mg = next((row for row in monthly_list if str(row.get("id")) == mid), None) if mid else None
        if not mg:
            mg = _match_monthly_goal_by_ref(
                g.get("monthly_goal_ref"),
                monthly_list,
            )
        if not mg and g.get("yearly_goal_ref"):
            mg = _match_monthly_goal_by_ref(g.get("yearly_goal_ref"), monthly_list)
        if not mg and g.get("is_main") and single_main_monthly:
            mg = single_main_monthly
        if not mg and g.get("yearly_goal_ref"):
            mg = _match_monthly_goal_by_ref(g.get("yearly_goal_ref"), monthly_list)
        if not mg and g.get("is_main") and single_main_monthly:
            mg = single_main_monthly
        mid = mg.get("id") if mg else mid
        workload = g.get("estimated_effort") or g.get("workload")
        is_ai_suggested = _row_matches_draft(g.get("title", ""), all_draft_items)
        goal_records.append({
            "session_id": str(session_id),
            "weekly_plan_id": plan_id,
            "title": g["title"],
            "description": g.get("description"),
            "monthly_goal_id": str(mid) if mid else None,
            "year": year,
            "month": month,
            "week_number": week_number,
            "status": "active",
            "progress": 0,
            "is_main": g.get("is_main", False),
            "ai_suggested": is_ai_suggested,
            "workload": workload,
        })

    if goal_records:
        plans_db.bulk_create_weekly_goals(db, goal_records)

    updated_plan = plans_db.update_weekly_plan(db, UUID(plan_id), {
        "status": "active",
        "approved_at": datetime.now(timezone.utc).isoformat(),
    })

    logger.info("weekly_plan_approved", session_id=str(session_id), week=week_number)
    return updated_plan


# ─── Daily Plan ───────────────────────────────────────────────────────────────

def generate_daily_plan(
    db: Client,
    session_id: UUID,
    plan_date,
) -> dict:
    from datetime import date as date_type
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_temporal_context(plan_date, week_starts_on)
    week_number = week_number_for(plan_date, week_starts_on)

    weekly_goals = plans_db.list_weekly_goals(db, session_id, plan_date.year, week_number)
    single_main_weekly = _single_main_goal(weekly_goals)
    habits = habits_db.list_habits(db, session_id, active_only=True)

    # Fail before calling the model — avoids token spend on an empty planning context
    if not weekly_goals and not habits:
        raise NotFoundError(
            "Weekly goals / habits",
            "add or approve a weekly plan (or habits) before generating a daily plan",
        )

    # Count remaining weekly tasks (not completed)
    weekly_remaining = sum(
        1 for g in weekly_goals if g.get("status") not in ("completed", "missed")
    )

    month = plan_date.month
    monthly_goals = plans_db.list_monthly_goals(db, session_id, plan_date.year, month)
    yearly_goals = yg_db.list_yearly_goals(db, session_id, plan_date.year)

    # Build yesterday_completion from the prior day's report metrics if available
    from datetime import timedelta
    yesterday_date = plan_date - timedelta(days=1)
    yesterday_completion = {}
    try:
        yesterday_report = reports_db.get_report(
            db, session_id, "daily",
            period_year=yesterday_date.year,
            period_date=yesterday_date,
        )
        if yesterday_report and yesterday_report.get("metrics"):
            m = yesterday_report["metrics"]
            yesterday_completion = {
                "completion_rate": m.get("completion_rate", 0),
                "priorities_completed": m.get("priorities_completed", 0),
                "priorities_total": m.get("priorities_total", 0),
            }
    except Exception:
        pass

    existing = plans_db.list_daily_priorities(db, session_id, plan_date)
    payload = build_daily_planning_payload(
        ctx=ctx,
        weekly_goals=weekly_goals,
        weekly_remaining_tasks=weekly_remaining,
        existing_daily=existing,
        habits=habits,
        monthly_goals=monthly_goals,
        yearly_goals=yearly_goals,
        yesterday_completion=yesterday_completion,
    )

    start = datetime.now(timezone.utc)
    ai_output = ai_service.generate_daily_plan(payload)
    ai_output = _cap_ai_plan_items(
        ai_output,
        main_field="top_priorities",
        secondary_field="secondary_tasks",
        max_main=payload["workload_budget"]["max_daily_priorities"],
        max_secondary=payload["workload_budget"]["max_secondary_tasks"],
    )
    ai_output = _normalize_daily_ai_output(ai_output, weekly_goals, monthly_goals, yearly_goals)
    latency_ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
    _log_generation(db, session_id, "daily_plan", latency_ms=latency_ms)

    # Fetch or create weekly plan record for FK
    weekly_plan = plans_db.get_weekly_plan(db, session_id, plan_date.year, week_number)

    plan = plans_db.upsert_daily_plan(db, session_id, {
        "weekly_plan_id": weekly_plan["id"] if weekly_plan else None,
        "date": plan_date.isoformat(),
        "status": "draft",
        "ai_draft": ai_output.model_dump(),
        "ai_generated_at": datetime.now(timezone.utc).isoformat(),
    })

    logger.info("daily_plan_generated", session_id=str(session_id), date=plan_date.isoformat())
    return plan


def approve_daily_plan(
    db: Client,
    session_id: UUID,
    plan_date,
    custom_priorities: list[dict] | None = None,
) -> dict:
    plan = plans_db.get_daily_plan(db, session_id, plan_date)
    if not plan:
        raise NotFoundError("Daily plan", plan_date.isoformat())

    if plan["status"] == "locked":
        raise PlanLockedError("Daily plan")

    plan_id = plan["id"]
    plans_db.delete_daily_priorities_for_plan(db, UUID(plan_id))

    if custom_priorities:
        items_to_create = custom_priorities
    else:
        draft = plan.get("ai_draft") or {}
        items_to_create = [
            {**p, "is_main": True, "priority": "high"}
            for p in draft.get("top_priorities", [])
        ] + [
            {**p, "is_main": False}
            for p in draft.get("secondary_tasks", [])
        ]

    _assert_main_goal_cap(_count_main_rows(items_to_create), "day", "priorities")

    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    week_number = week_number_for(plan_date, week_starts_on)
    weekly_goals = plans_db.list_weekly_goals(db, session_id, plan_date.year, week_number)

    # Per-row ai_suggested: compare against draft
    plan_draft = plan.get("ai_draft") or {}
    all_draft_items = plan_draft.get("top_priorities", []) + plan_draft.get("secondary_tasks", [])

    priority_records = []
    for item in items_to_create:
        effort_str = item.get("estimated_effort", "") or ""
        estimated_minutes = _parse_minutes(effort_str)
        wid = _linked_id_from_item(item, "weekly_goal_id", weekly_goals)
        if not wid:
            wg = _match_weekly_goal_by_ref(
                item.get("weekly_goal_ref"),
                weekly_goals,
            )
            if not wg and item.get("monthly_goal_ref"):
                wg = _match_weekly_goal_by_ref(item.get("monthly_goal_ref"), weekly_goals)
            if not wg and item.get("yearly_goal_ref"):
                wg = _match_weekly_goal_by_ref(item.get("yearly_goal_ref"), weekly_goals)
            wid = wg.get("id") if wg else None
        if not wid and item.get("is_main") and single_main_weekly:
            wid = str(single_main_weekly.get("id"))
        is_ai_suggested = _row_matches_draft(item.get("title", ""), all_draft_items)
        priority_records.append({
            "session_id": str(session_id),
            "daily_plan_id": plan_id,
            "weekly_goal_id": str(wid) if wid else None,
            "title": item["title"],
            "description": item.get("description"),
            "date": plan_date.isoformat(),
            "status": "active",
            "completed": False,
            "priority": item.get("priority", "medium"),
            "estimated_minutes": estimated_minutes,
            "is_main": item.get("is_main", True),
            "tag": item.get("tag"),
            "ai_suggested": is_ai_suggested,
        })

    if priority_records:
        plans_db.bulk_create_daily_priorities(db, priority_records)

    updated_plan = plans_db.update_daily_plan(db, UUID(plan_id), {
        "status": "active",
        "approved_at": datetime.now(timezone.utc).isoformat(),
    })

    logger.info("daily_plan_approved", session_id=str(session_id), date=plan_date.isoformat())
    return updated_plan


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_minutes(effort_str: str) -> int | None:
    """Extract integer minutes from effort strings like '90 min', '2 hours', '1.5 hours'."""
    import re
    if not effort_str:
        return None
    effort_str = effort_str.lower()
    hours_match = re.search(r"(\d+\.?\d*)\s*h", effort_str)
    min_match = re.search(r"(\d+)\s*m", effort_str)
    if hours_match:
        return int(float(hours_match.group(1)) * 60)
    if min_match:
        return int(min_match.group(1))
    return None


def _log_generation(
    db: Client,
    session_id: UUID,
    generation_type: str,
    latency_ms: int = 0,
    success: bool = True,
    error: str | None = None,
) -> None:
    settings = __import__("app.core.config", fromlist=["get_settings"]).get_settings()
    reports_db.log_ai_generation(db, {
        "session_id": str(session_id),
        "generation_type": generation_type,
        "model_name": settings.gemini_model,
        "latency_ms": latency_ms,
        "success": success,
        "error_message": error,
    })
