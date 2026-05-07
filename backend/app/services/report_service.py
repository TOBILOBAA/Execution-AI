"""
Report generation and retrieval service.

Principle:
1. Aggregate data and compute metrics in Python (deterministic)
2. Pass compact metrics summary to Gemini for narrative
3. Persist snapshot with both metrics and narrative

Reports are generated on-demand, after the relevant period cutoff.
"""
from collections import Counter
from datetime import date, datetime, timezone, timedelta
from uuid import UUID
import calendar

from supabase import Client

from app.core.config import get_settings
from app.core.exceptions import ValidationError
from app.core.logging import logger
import app.db.sessions as sessions_db
from app.utils.date_utils import (
    get_temporal_context,
    get_week_boundaries,
    week_date_range_label,
    month_name,
)
from app.utils.metrics import (
    aggregate_daily_metrics,
    aggregate_weekly_metrics,
    aggregate_monthly_metrics,
    aggregate_quarterly_metrics,
    aggregate_yearly_metrics,
)
from app.services import ai_service
from app.services.report_context import build_execution_diary, build_report_prompt_context
import app.db.plans as plans_db
import app.db.habits as habits_db
import app.db.reports as reports_db
import app.db.categories as categories_db
from app.utils.period_guards import get_session_today


def _report_identity(
    report_type: str,
    period_year: int | None,
    period_month: int | None = None,
    period_quarter: int | None = None,
    period_week: int | None = None,
    period_date: str | None = None,
) -> tuple[str, int | None, int | None, int | None, int | None, str | None]:
    if report_type == "daily":
        return (report_type, period_year, None, None, None, period_date)
    if report_type == "weekly":
        return (report_type, period_year, None, None, period_week, None)
    if report_type == "monthly":
        return (report_type, period_year, period_month, None, None, None)
    if report_type == "quarterly":
        return (report_type, period_year, None, period_quarter, None, None)
    return (report_type, period_year, None, None, None, None)


def _quarter_months(quarter: int) -> tuple[int, int, int]:
    start_month = ((quarter - 1) * 3) + 1
    return (start_month, start_month + 1, start_month + 2)


def _quarter_label(year: int, quarter: int) -> str:
    return f"Q{quarter} {year}"


def _period_window(report: dict, week_starts_on: str) -> tuple[date, date] | None:
    report_type = report.get("report_type")
    year = report.get("period_year")
    if report_type == "daily" and report.get("period_date"):
        report_date = date.fromisoformat(report["period_date"])
        return report_date, report_date
    if report_type == "weekly" and year and report.get("period_week"):
        return get_week_boundaries(year, report["period_week"], week_starts_on)
    if report_type == "monthly" and year and report.get("period_month"):
        month = report["period_month"]
        return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])
    if report_type == "quarterly" and year and report.get("period_quarter"):
        months = _quarter_months(report["period_quarter"])
        start = date(year, months[0], 1)
        end = date(year, months[-1], calendar.monthrange(year, months[-1])[1])
        return start, end
    if report_type == "yearly" and year:
        return date(year, 1, 1), date(year, 12, 31)
    return None


def _can_refresh_stale_daily_report(report: dict, today: date, now_utc: datetime, cutoff_hour: int) -> bool:
    if report.get("report_type") != "daily":
        return False
    if report.get("status") != "stale":
        return False
    if report.get("period_date") != today.isoformat():
        return False
    return now_utc.hour >= cutoff_hour


def _has_execution_data_between(db: Client, session_id: UUID, start: date, end: date) -> bool:
    priorities = (
        db.table("daily_priorities")
        .select("id")
        .eq("session_id", str(session_id))
        .gte("date", start.isoformat())
        .lte("date", end.isoformat())
        .limit(1)
        .execute()
        .data
        or []
    )
    if priorities:
        return True

    completed_habits = (
        db.table("habit_logs")
        .select("id")
        .eq("session_id", str(session_id))
        .eq("completed", True)
        .gte("date", start.isoformat())
        .lte("date", end.isoformat())
        .limit(1)
        .execute()
        .data
        or []
    )
    return bool(completed_habits)


def _decorate_report(db: Client, session_id: UUID, report: dict) -> dict:
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    window = _period_window(report, week_starts_on)
    ai_narrative = report.get("ai_narrative") if isinstance(report.get("ai_narrative"), dict) else None
    tailored_pattern = report.get("tailored_pattern") or (ai_narrative or {}).get("tailored_pattern")
    tailored_action = report.get("tailored_action") or (ai_narrative or {}).get("tailored_action")
    has_execution_data = (
        _has_execution_data_between(db, session_id, window[0], window[1])
        if window is not None
        else False
    )
    return {
        **report,
        "tailored_pattern": tailored_pattern,
        "tailored_action": tailored_action,
        "has_execution_data": has_execution_data,
    }


# ─── Daily Report ─────────────────────────────────────────────────────────────

def generate_daily_report(db: Client, session_id: UUID, report_date: date) -> dict:
    """
    Generate or regenerate a daily report for the given date.
    Enforces cutoff hour: reports can only be generated after REPORT_CUTOFF_HOUR UTC.
    """
    settings = get_settings()
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_temporal_context(week_starts_on=week_starts_on)
    now_utc = datetime.now(timezone.utc)

    # Cutoff guard: only enforce for today's report
    if report_date == ctx.today and now_utc.hour < settings.report_cutoff_hour:
        raise ValidationError(
            f"Daily report is available after {settings.report_cutoff_hour}:00 UTC. "
            f"Current hour: {now_utc.hour}:00 UTC."
        )

    # Gather data
    priorities = plans_db.list_daily_priorities(db, session_id, report_date)
    main_tasks = [p for p in priorities if p.get("is_main")]
    secondary_tasks = [p for p in priorities if not p.get("is_main")]

    habits = habits_db.list_habits(db, session_id, active_only=True)
    habit_logs = habits_db.list_habit_logs_for_session(db, session_id, report_date, report_date)
    completed_habit_ids = {log["habit_id"] for log in habit_logs if log["completed"]}
    daily_habits = [h for h in habits if h.get("frequency") == "daily"]
    habits_completed = sum(1 for h in daily_habits if h["id"] in completed_habit_ids)
    habits_total = len(daily_habits)

    # Compute metrics in code
    metrics = aggregate_daily_metrics(
        priorities=main_tasks,
        secondary_tasks=secondary_tasks,
        habits_completed=habits_completed,
        habits_total=habits_total,
    )
    metrics["date"] = report_date.isoformat()
    goal_context = build_report_prompt_context(session_id, report_date, report_date, db)
    execution_diary = build_execution_diary(session_id, report_date, report_date, db)

    # AI narrative
    ai_narrative = None
    try:
        narrative = ai_service.generate_daily_report(
            metrics,
            report_date.isoformat(),
            goal_context=goal_context,
            execution_diary=execution_diary,
        )
        ai_narrative = narrative.model_dump()
    except Exception as exc:
        logger.error("daily_report_ai_failed", date=report_date.isoformat(), error=str(exc))

    # Persist
    report = reports_db.upsert_report(db, session_id, {
        "report_type": "daily",
        "period_date": report_date.isoformat(),
        "period_year": report_date.year,
        "period_month": report_date.month,
        "metrics": metrics,
        "ai_narrative": ai_narrative,
        "ai_generated_at": datetime.now(timezone.utc).isoformat() if ai_narrative else None,
        "status": "ready" if ai_narrative else "failed",
    })

    _log_generation(db, session_id, "daily_report")
    logger.info("daily_report_generated", session_id=str(session_id), date=report_date.isoformat())
    return _decorate_report(db, session_id, report)


# ─── Weekly Report ────────────────────────────────────────────────────────────

def generate_weekly_report(
    db: Client, session_id: UUID, year: int, week_number: int
) -> dict:
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    week_start, week_end = get_week_boundaries(year, week_number, week_starts_on)
    week_label = week_date_range_label(week_start, week_end)
    weekly_plan = plans_db.get_weekly_plan(db, session_id, year, week_number)

    # Collect all daily data for the week
    daily_plans = plans_db.list_daily_plans_for_week(db, session_id, week_start, week_end)
    daily_summaries = []
    for dp in daily_plans:
        day = date.fromisoformat(dp["date"])
        priorities = plans_db.list_daily_priorities(db, session_id, day)
        main_tasks = [p for p in priorities if p.get("is_main")]
        secondary = [p for p in priorities if not p.get("is_main")]
        habits = habits_db.list_habits(db, session_id, active_only=True)
        habit_logs = habits_db.list_habit_logs_for_session(db, session_id, day, day)
        completed_ids = {log["habit_id"] for log in habit_logs if log["completed"]}
        daily_habits = [h for h in habits if h.get("frequency") == "daily"]
        summary = aggregate_daily_metrics(
            main_tasks, secondary,
            sum(1 for h in daily_habits if h["id"] in completed_ids),
            len(daily_habits),
        )
        daily_summaries.append(summary)

    weekly_goals = plans_db.list_weekly_goals(db, session_id, year, week_number)
    metrics = aggregate_weekly_metrics(weekly_goals, daily_summaries)
    metrics["year"] = year
    metrics["week_number"] = week_number
    metrics["week_start"] = week_start.isoformat()
    metrics["week_end"] = week_end.isoformat()
    goal_context = build_report_prompt_context(session_id, week_start, week_end, db)
    execution_diary = build_execution_diary(session_id, week_start, week_end, db)

    ai_narrative = None
    try:
        narrative = ai_service.generate_weekly_report(
            metrics,
            week_label,
            goal_context=goal_context,
            execution_diary=execution_diary,
        )
        ai_narrative = narrative.model_dump()
    except Exception as exc:
        logger.error("weekly_report_ai_failed", week=week_number, error=str(exc))

    report = reports_db.upsert_report(db, session_id, {
        "report_type": "weekly",
        "period_week": week_number,
        "period_year": year,
        "period_month": weekly_plan.get("month") if weekly_plan else week_start.month,
        "metrics": metrics,
        "ai_narrative": ai_narrative,
        "tailored_pattern": ai_narrative.get("tailored_pattern") if ai_narrative else None,
        "tailored_action": ai_narrative.get("tailored_action") if ai_narrative else None,
        "ai_generated_at": datetime.now(timezone.utc).isoformat() if ai_narrative else None,
        "status": "ready" if ai_narrative else "failed",
    })

    _log_generation(db, session_id, "weekly_report")
    logger.info("weekly_report_generated", session_id=str(session_id), week=week_number)
    return _decorate_report(db, session_id, report)


# ─── Monthly Report ───────────────────────────────────────────────────────────

def generate_monthly_report(
    db: Client, session_id: UUID, year: int, month: int
) -> dict:
    month_label = f"{month_name(month)} {year}"

    monthly_goals = plans_db.list_monthly_goals(db, session_id, year, month)
    weekly_plans = plans_db.list_weekly_plans_for_month(db, session_id, year, month)

    weekly_summaries = []
    for wp in weekly_plans:
        week_start = date.fromisoformat(wp["week_start"])
        week_end = date.fromisoformat(wp["week_end"])
        wk = wp["week_number"]
        daily_plans = plans_db.list_daily_plans_for_week(db, session_id, week_start, week_end)
        daily_sums = []
        for dp in daily_plans:
            day = date.fromisoformat(dp["date"])
            priorities = plans_db.list_daily_priorities(db, session_id, day)
            habits = habits_db.list_habits(db, session_id, active_only=True)
            habit_logs = habits_db.list_habit_logs_for_session(db, session_id, day, day)
            completed_ids = {log["habit_id"] for log in habit_logs if log["completed"]}
            daily_habits = [h for h in habits if h.get("frequency") == "daily"]
            main = [p for p in priorities if p.get("is_main")]
            secondary = [p for p in priorities if not p.get("is_main")]
            ds = aggregate_daily_metrics(
                main, secondary,
                sum(1 for h in daily_habits if h["id"] in completed_ids),
                len(daily_habits),
            )
            daily_sums.append(ds)

        weekly_goals = plans_db.list_weekly_goals(db, session_id, year, wk)
        ws = aggregate_weekly_metrics(weekly_goals, daily_sums)
        ws["week_number"] = wk
        weekly_summaries.append(ws)

    metrics = aggregate_monthly_metrics(monthly_goals, weekly_summaries)
    metrics["year"] = year
    metrics["month"] = month
    month_start = date(year, month, 1)
    month_end = date(year, month, calendar.monthrange(year, month)[1])
    goal_context = build_report_prompt_context(session_id, month_start, month_end, db)
    execution_diary = build_execution_diary(session_id, month_start, month_end, db)

    ai_narrative = None
    try:
        narrative = ai_service.generate_monthly_report(
            metrics,
            month_label,
            goal_context=goal_context,
            execution_diary=execution_diary,
        )
        ai_narrative = narrative.model_dump()
    except Exception as exc:
        logger.error("monthly_report_ai_failed", month=month, error=str(exc))

    report = reports_db.upsert_report(db, session_id, {
        "report_type": "monthly",
        "period_month": month,
        "period_year": year,
        "metrics": metrics,
        "ai_narrative": ai_narrative,
        "tailored_pattern": ai_narrative.get("tailored_pattern") if ai_narrative else None,
        "tailored_action": ai_narrative.get("tailored_action") if ai_narrative else None,
        "ai_generated_at": datetime.now(timezone.utc).isoformat() if ai_narrative else None,
        "status": "ready" if ai_narrative else "failed",
    })

    _log_generation(db, session_id, "monthly_report")
    logger.info("monthly_report_generated", session_id=str(session_id), month=month)
    return _decorate_report(db, session_id, report)


# ─── Quarterly Report ─────────────────────────────────────────────────────────

def generate_quarterly_report(db: Client, session_id: UUID, year: int, quarter: int) -> dict:
    months = _quarter_months(quarter)
    month_label = ", ".join(month_name(month) for month in months)
    category_lookup = {
        row["id"]: row["name"]
        for row in categories_db.list_categories(db, session_id)
    }
    monthly_summaries_by_key: dict[tuple[int, int], dict] = {}

    for month in months:
        monthly_summaries_by_key[(year, month)] = _build_monthly_summary(
            db,
            session_id,
            year,
            month,
            category_lookup,
            {},
        )

    summary = _build_quarterly_summary(
        db,
        session_id,
        year,
        quarter,
        monthly_summaries_by_key,
    )
    metrics = summary["metrics"]
    quarter_start = date(year, months[0], 1)
    quarter_end = date(year, months[-1], calendar.monthrange(year, months[-1])[1])
    goal_context = build_report_prompt_context(session_id, quarter_start, quarter_end, db)
    execution_diary = build_execution_diary(session_id, quarter_start, quarter_end, db)

    ai_narrative = None
    try:
        narrative = ai_service.generate_quarterly_report(
            metrics,
            _quarter_label(year, quarter),
            goal_context=goal_context,
            execution_diary=execution_diary,
        )
        ai_narrative = narrative.model_dump()
    except Exception as exc:
        logger.error("quarterly_report_ai_failed", year=year, quarter=quarter, error=str(exc))

    report = reports_db.upsert_report(db, session_id, {
        "report_type": "quarterly",
        "period_year": year,
        "period_quarter": quarter,
        "metrics": metrics,
        "ai_narrative": ai_narrative,
        "tailored_pattern": ai_narrative.get("tailored_pattern") if ai_narrative else None,
        "tailored_action": ai_narrative.get("tailored_action") if ai_narrative else None,
        "ai_generated_at": datetime.now(timezone.utc).isoformat() if ai_narrative else None,
        "status": "ready" if ai_narrative else "failed",
    })

    _log_generation(db, session_id, "quarterly_report")
    logger.info("quarterly_report_generated", session_id=str(session_id), year=year, quarter=quarter, months=month_label)
    return _decorate_report(db, session_id, report)


# ─── Yearly Report ────────────────────────────────────────────────────────────

def generate_yearly_report(db: Client, session_id: UUID, year: int) -> dict:
    monthly_summaries = []
    for month in range(1, 13):
        monthly_goals = plans_db.list_monthly_goals(db, session_id, year, month)
        if not monthly_goals:
            continue
        weekly_plans = plans_db.list_weekly_plans_for_month(db, session_id, year, month)
        wk_sums = []
        for wp in weekly_plans:
            week_start = date.fromisoformat(wp["week_start"])
            week_end = date.fromisoformat(wp["week_end"])
            wk = wp["week_number"]
            daily_plans = plans_db.list_daily_plans_for_week(db, session_id, week_start, week_end)
            daily_sums = []
            for dp in daily_plans:
                day = date.fromisoformat(dp["date"])
                priorities = plans_db.list_daily_priorities(db, session_id, day)
                habits = habits_db.list_habits(db, session_id, active_only=True)
                habit_logs = habits_db.list_habit_logs_for_session(db, session_id, day, day)
                completed_ids = {log["habit_id"] for log in habit_logs if log["completed"]}
                daily_habits = [h for h in habits if h.get("frequency") == "daily"]
                main = [p for p in priorities if p.get("is_main")]
                secondary = [p for p in priorities if not p.get("is_main")]
                ds = aggregate_daily_metrics(
                    main, secondary,
                    sum(1 for h in daily_habits if h["id"] in completed_ids),
                    len(daily_habits),
                )
                daily_sums.append(ds)
            wk_goals = plans_db.list_weekly_goals(db, session_id, year, wk)
            ws = aggregate_weekly_metrics(wk_goals, daily_sums)
            ws["week_number"] = wk
            wk_sums.append(ws)

        ms = aggregate_monthly_metrics(monthly_goals, wk_sums)
        ms["month"] = month
        monthly_summaries.append(ms)

    # Execution streak from latest daily report or recompute
    from app.services.dashboard_service import _compute_execution_streak
    streak = _compute_execution_streak(db, session_id, date.today())

    # Previous year comparison
    prev_report = reports_db.get_report(db, session_id, "yearly", year - 1)
    prev_completion = None
    if prev_report:
        prev_completion = prev_report.get("metrics", {}).get("avg_monthly_completion")

    metrics = aggregate_yearly_metrics(monthly_summaries, streak, prev_completion)
    metrics["year"] = year
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)
    goal_context = build_report_prompt_context(session_id, year_start, year_end, db)
    execution_diary = build_execution_diary(session_id, year_start, year_end, db)

    ai_narrative = None
    try:
        narrative = ai_service.generate_yearly_report(
            metrics,
            year,
            goal_context=goal_context,
            execution_diary=execution_diary,
        )
        ai_narrative = narrative.model_dump()
    except Exception as exc:
        logger.error("yearly_report_ai_failed", year=year, error=str(exc))

    report = reports_db.upsert_report(db, session_id, {
        "report_type": "yearly",
        "period_year": year,
        "metrics": metrics,
        "ai_narrative": ai_narrative,
        "tailored_pattern": ai_narrative.get("tailored_pattern") if ai_narrative else None,
        "tailored_action": ai_narrative.get("tailored_action") if ai_narrative else None,
        "ai_generated_at": datetime.now(timezone.utc).isoformat() if ai_narrative else None,
        "status": "ready" if ai_narrative else "failed",
    })

    _log_generation(db, session_id, "yearly_report")
    logger.info("yearly_report_generated", session_id=str(session_id), year=year)
    return _decorate_report(db, session_id, report)


def list_reports(db: Client, session_id: UUID) -> list[dict]:
    existing_reports = reports_db.list_reports(db, session_id)
    today = get_session_today(db, session_id)
    settings = get_settings()
    now_utc = datetime.now(timezone.utc)
    refreshed_reports: list[dict] = []
    for report in existing_reports:
        if _can_refresh_stale_daily_report(
            report,
            today,
            now_utc,
            settings.report_cutoff_hour,
        ):
            refreshed_reports.append(generate_daily_report(db, session_id, today))
        else:
            refreshed_reports.append(report)
    existing_reports = refreshed_reports
    generated_reports = ensure_historical_reports(db, session_id, existing_reports)
    merged = {
        _report_identity(
            report["report_type"],
            report.get("period_year"),
            report.get("period_month"),
            report.get("period_quarter"),
            report.get("period_week"),
            report.get("period_date"),
        ): report
        for report in [*existing_reports, *generated_reports]
    }
    ordered = sorted(
        merged.values(),
        key=lambda report: (
            -(report.get("period_year") or 0),
            -(report.get("period_quarter") or 0),
            -(report.get("period_month") or 0),
            -(report.get("period_week") or 0),
            report.get("period_date") or "",
            report.get("created_at") or "",
        ),
        reverse=False,
    )
    return [_decorate_report(db, session_id, report) for report in ordered]


def _log_generation(db: Client, session_id: UUID, gen_type: str) -> None:
    reports_db.log_ai_generation(db, {
        "session_id": str(session_id),
        "generation_type": gen_type,
        "success": True,
    })


def ensure_historical_reports(
    db: Client,
    session_id: UUID,
    existing_reports: list[dict] | None = None,
) -> list[dict]:
    """
    Backfill deterministic snapshots from existing planning data.

    Imported history often contains goals, plans, and habit logs but no
    pre-generated report rows. This helper makes the archive truthful without
    forcing the user to regenerate every historical period manually.
    """
    existing_reports = existing_reports or reports_db.list_reports(db, session_id)
    existing_keys = {
        _report_identity(
            report["report_type"],
            report.get("period_year"),
            report.get("period_month"),
            report.get("period_quarter"),
            report.get("period_week"),
            report.get("period_date"),
        )
        for report in existing_reports
    }
    generated_reports: list[dict] = []

    category_lookup = {
        row["id"]: row["name"]
        for row in categories_db.list_categories(db, session_id)
    }
    daily_plan_rows = (
        db.table("daily_plans")
        .select("date")
        .eq("session_id", str(session_id))
        .order("date")
        .execute()
        .data
        or []
    )

    weekly_plans = (
        db.table("weekly_plans")
        .select("year,month,week_number,week_start,week_end")
        .eq("session_id", str(session_id))
        .order("year")
        .order("week_number")
        .execute()
        .data
        or []
    )
    monthly_rows = (
        db.table("monthly_goals")
        .select("year,month")
        .eq("session_id", str(session_id))
        .execute()
        .data
        or []
    )
    yearly_rows = (
        db.table("yearly_goals")
        .select("year")
        .eq("session_id", str(session_id))
        .execute()
        .data
        or []
    )

    weekly_summaries_by_key: dict[tuple[int, int], dict] = {}
    monthly_summaries_by_key: dict[tuple[int, int], dict] = {}

    for row in daily_plan_rows:
        plan_date = date.fromisoformat(row["date"])
        report_key = _report_identity("daily", plan_date.year, period_date=plan_date.isoformat())

        if report_key in existing_keys:
            continue

        metrics = _build_daily_summary(db, session_id, plan_date)
        metrics["date"] = plan_date.isoformat()
        generated_reports.append(
            _upsert_or_stage_report(
                db,
                session_id,
                {
                    "report_type": "daily",
                    "period_date": plan_date.isoformat(),
                    "period_month": plan_date.month,
                    "period_year": plan_date.year,
                    "metrics": metrics,
                    "ai_narrative": {
                        "summary": f"Execution snapshot for {plan_date.isoformat()} reconstructed from saved priorities and habits.",
                        "top_win": f"Completed {metrics['priorities_completed']} of {metrics['priorities_total']} main priorities.",
                        "key_miss": f"{metrics['secondary_tasks_total'] - metrics['secondary_tasks_completed']} secondary tasks were left unfinished.",
                        "reflection": "This historical daily report was reconstructed from saved execution data.",
                        "tomorrow_focus": "Carry the most important unfinished work into the next planned day.",
                    },
                    "ai_generated_at": None,
                    "status": "ready",
                },
            )
        )
        existing_keys.add(report_key)

    for plan in weekly_plans:
        year = plan["year"]
        week_number = plan["week_number"]
        week_start = date.fromisoformat(plan["week_start"])
        week_end = date.fromisoformat(plan["week_end"])
        report_key = _report_identity("weekly", year, period_week=week_number)

        summary = _build_weekly_summary(
            db,
            session_id,
            year,
            week_number,
            week_start,
            week_end,
            category_lookup,
        )
        weekly_summaries_by_key[(year, week_number)] = summary

        if report_key in existing_keys:
            continue

        generated_reports.append(
            _upsert_or_stage_report(
                db,
                session_id,
                {
                    "report_type": "weekly",
                    "period_week": week_number,
                    "period_year": year,
                    "period_month": plan.get("month") or week_start.month,
                    "metrics": summary["metrics"],
                    "ai_narrative": summary["ai_narrative"],
                    "ai_generated_at": None,
                    "status": "ready",
                },
            )
        )
        existing_keys.add(report_key)

    months = {
        (row["year"], row["month"])
        for row in monthly_rows
        if row.get("year") and row.get("month")
    } | {
        (row["year"], row["month"])
        for row in weekly_plans
        if row.get("year") and row.get("month")
    }

    for year, month in sorted(months):
        report_key = _report_identity("monthly", year, period_month=month)
        summary = _build_monthly_summary(
            db,
            session_id,
            year,
            month,
            category_lookup,
            weekly_summaries_by_key,
        )
        monthly_summaries_by_key[(year, month)] = summary

        if report_key in existing_keys:
            continue

        generated_reports.append(
            _upsert_or_stage_report(
                db,
                session_id,
                {
                    "report_type": "monthly",
                    "period_month": month,
                    "period_year": year,
                    "metrics": summary["metrics"],
                    "ai_narrative": summary["ai_narrative"],
                    "ai_generated_at": None,
                    "status": "ready",
                },
            )
        )
        existing_keys.add(report_key)

    quarter_keys = {
        (year, quarter)
        for year, month in months
        for quarter in [((month - 1) // 3) + 1]
    }

    for year, quarter in sorted(quarter_keys):
        report_key = _report_identity("quarterly", year, period_quarter=quarter)
        summary = _build_quarterly_summary(
            db,
            session_id,
            year,
            quarter,
            monthly_summaries_by_key,
        )

        if report_key in existing_keys:
            continue

        generated_reports.append(
            _upsert_or_stage_report(
                db,
                session_id,
                {
                    "report_type": "quarterly",
                    "period_year": year,
                    "period_quarter": quarter,
                    "metrics": summary["metrics"],
                    "ai_narrative": summary["ai_narrative"],
                    "tailored_pattern": summary["ai_narrative"].get("tailored_pattern"),
                    "tailored_action": summary["ai_narrative"].get("tailored_action"),
                    "ai_generated_at": None,
                    "status": "ready",
                },
            )
        )
        existing_keys.add(report_key)

    years = {
        row["year"]
        for row in yearly_rows
        if row.get("year")
    } | {
        year for year, _month in months
    }

    yearly_goal_rows = (
        db.table("yearly_goals")
        .select("year,category_id")
        .eq("session_id", str(session_id))
        .execute()
        .data
        or []
    )
    yearly_categories_by_year: dict[int, list[dict]] = {}
    for row in yearly_goal_rows:
        yearly_categories_by_year.setdefault(row["year"], []).append(row)

    previous_completion: dict[int, int] = {}
    for year in sorted(years):
        report_key = _report_identity("yearly", year)
        summary = _build_yearly_summary(
            db,
            session_id,
            year,
            category_lookup,
            monthly_summaries_by_key,
            yearly_categories_by_year.get(year, []),
            previous_completion.get(year - 1),
        )
        previous_completion[year] = summary["metrics"]["avg_monthly_completion"]

        if report_key in existing_keys:
            continue

        generated_reports.append(
            _upsert_or_stage_report(
                db,
                session_id,
                {
                    "report_type": "yearly",
                    "period_year": year,
                    "metrics": summary["metrics"],
                    "ai_narrative": summary["ai_narrative"],
                    "ai_generated_at": None,
                    "status": "ready",
                },
            )
        )
        existing_keys.add(report_key)

    return generated_reports


def _upsert_or_stage_report(db: Client, session_id: UUID, data: dict) -> dict:
    """
    Prefer persisting the snapshot, but fall back to an in-memory response row
    if the current DB uniqueness indexes are too restrictive for that shape.
    """
    try:
        return reports_db.upsert_report(db, session_id, data)
    except Exception as exc:
        logger.warning(
            "report_snapshot_stage_fallback",
            session_id=str(session_id),
            report_type=data.get("report_type"),
            year=data.get("period_year"),
            quarter=data.get("period_quarter"),
            month=data.get("period_month"),
            week=data.get("period_week"),
            error=str(exc),
        )
        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "id": (
                f"staged-{data.get('report_type')}-{data.get('period_year')}-"
                f"{data.get('period_quarter')}-{data.get('period_month')}-"
                f"{data.get('period_week')}-{data.get('period_date') or 'na'}"
            ),
            "session_id": str(session_id),
            **data,
            "created_at": now_iso,
            "updated_at": now_iso,
        }


def _build_daily_summary(db: Client, session_id: UUID, plan_date: date) -> dict:
    priorities = plans_db.list_daily_priorities(db, session_id, plan_date)
    main_tasks = [p for p in priorities if p.get("is_main")]
    secondary_tasks = [p for p in priorities if not p.get("is_main")]
    habits = habits_db.list_habits(db, session_id, active_only=True)
    habit_logs = habits_db.list_habit_logs_for_session(db, session_id, plan_date, plan_date)
    completed_ids = {log["habit_id"] for log in habit_logs if log.get("completed")}
    daily_habits = [habit for habit in habits if habit.get("frequency") == "daily"]
    return aggregate_daily_metrics(
        priorities=main_tasks,
        secondary_tasks=secondary_tasks,
        habits_completed=sum(1 for habit in daily_habits if habit["id"] in completed_ids),
        habits_total=len(daily_habits),
    )


def _best_pillar_name(rows: list[dict], category_lookup: dict[str, str]) -> str | None:
    counts = Counter(
        category_lookup[row["category_id"]]
        for row in rows
        if row.get("category_id") in category_lookup
    )
    if not counts:
        return None
    return counts.most_common(1)[0][0]


def _build_weekly_summary(
    db: Client,
    session_id: UUID,
    year: int,
    week_number: int,
    week_start: date,
    week_end: date,
    category_lookup: dict[str, str],
) -> dict:
    daily_plans = plans_db.list_daily_plans_for_week(db, session_id, week_start, week_end)
    daily_summaries = [
        _build_daily_summary(db, session_id, date.fromisoformat(plan["date"]))
        for plan in daily_plans
    ]
    weekly_goals = plans_db.list_weekly_goals(db, session_id, year, week_number)
    metrics = aggregate_weekly_metrics(weekly_goals, daily_summaries)
    metrics["year"] = year
    metrics["week_number"] = week_number
    metrics["week_start"] = week_start.isoformat()
    metrics["week_end"] = week_end.isoformat()
    metrics["best_pillar"] = _best_pillar_name(weekly_goals, category_lookup)

    main_titles = [goal["title"] for goal in weekly_goals if goal.get("is_main")]
    lead = main_titles[0] if main_titles else "the active sprint"
    ai_narrative = {
        "summary": f"Week {week_number} focused on {lead}.",
        "top_win": f"Completed {metrics['goals_completed']} of {metrics['goals_total']} weekly goals.",
        "key_pattern": f"Average daily completion settled at {metrics['avg_daily_completion']}%.",
        "reflection": "This historical snapshot was reconstructed from saved goals, plans, and habit logs.",
        "next_week_priority": f"Carry the strongest unfinished work from week {week_number} into the next sprint.",
    }
    return {"metrics": metrics, "ai_narrative": ai_narrative}


def _build_monthly_summary(
    db: Client,
    session_id: UUID,
    year: int,
    month: int,
    category_lookup: dict[str, str],
    weekly_summaries_by_key: dict[tuple[int, int], dict],
) -> dict:
    monthly_goals = plans_db.list_monthly_goals(db, session_id, year, month)
    weekly_plans = plans_db.list_weekly_plans_for_month(db, session_id, year, month)
    weekly_summaries = [
        weekly_summaries_by_key.get((year, plan["week_number"]), {}).get("metrics")
        or _build_weekly_summary(
            db,
            session_id,
            year,
            plan["week_number"],
            date.fromisoformat(plan["week_start"]),
            date.fromisoformat(plan["week_end"]),
            category_lookup,
        )["metrics"]
        for plan in weekly_plans
    ]

    metrics = aggregate_monthly_metrics(monthly_goals, weekly_summaries)
    metrics["year"] = year
    metrics["month"] = month
    metrics["best_pillar"] = _best_pillar_name(monthly_goals, category_lookup)

    ai_narrative = {
        "summary": f"{month_name(month)} {year} combined {len(monthly_goals)} monthly goal(s) across {len(weekly_summaries)} tracked week(s).",
        "top_pillar": metrics["best_pillar"],
        "biggest_win": f"{metrics['tasks_completed']} of {metrics['tasks_total']} tracked tasks were completed.",
        "key_lesson": "Historical imports are strongest when weekly planning and daily execution both exist for the same period.",
        "reflection": "This monthly narrative was reconstructed from saved planning rows rather than a live AI generation pass.",
        "next_month_focus": "Turn the strongest recurring monthly theme into a clearer main goal for the next month.",
    }
    return {"metrics": metrics, "ai_narrative": ai_narrative}


def _build_yearly_summary(
    db: Client,
    session_id: UUID,
    year: int,
    category_lookup: dict[str, str],
    monthly_summaries_by_key: dict[tuple[int, int], dict],
    yearly_goal_rows: list[dict],
    previous_completion: int | None,
) -> dict:
    monthly_summaries = [
        summary["metrics"]
        for (summary_year, _month), summary in sorted(monthly_summaries_by_key.items())
        if summary_year == year
    ]
    from app.services.dashboard_service import _compute_execution_streak

    metrics = aggregate_yearly_metrics(
        monthly_summaries=monthly_summaries,
        execution_streak=_compute_execution_streak(db, session_id, date.today()),
        previous_year_completion=previous_completion,
    )
    metrics["year"] = year
    metrics["best_pillar"] = _best_pillar_name(yearly_goal_rows, category_lookup)

    ai_narrative = {
        "summary": f"{year} contains {metrics['months_with_data']} month(s) with tracked execution history.",
        "top_pillar": metrics["best_pillar"],
        "biggest_win": f"{metrics['tasks_completed']} of {metrics['tasks_total']} tracked tasks were completed across the year.",
        "key_pattern": f"Average monthly completion settled at {metrics['avg_monthly_completion']}%.",
        "reflection": "This yearly snapshot was reconstructed from the saved history currently in your workspace.",
        "next_year_focus": "Keep importing or tracking each current week so the yearly archive stays truthful end to end.",
    }
    return {"metrics": metrics, "ai_narrative": ai_narrative}


def _build_quarterly_summary(
    db: Client,
    session_id: UUID,
    year: int,
    quarter: int,
    monthly_summaries_by_key: dict[tuple[int, int], dict],
) -> dict:
    months = _quarter_months(quarter)
    monthly_metrics: list[dict] = []
    for month in months:
        cached = monthly_summaries_by_key.get((year, month))
        if cached is not None:
            monthly_metrics.append(cached["metrics"])
            continue

        category_lookup = {
            row["id"]: row["name"]
            for row in categories_db.list_categories(db, session_id)
        }
        fallback = _build_monthly_summary(
            db,
            session_id,
            year,
            month,
            category_lookup,
            {},
        )
        monthly_metrics.append(fallback["metrics"])

    yearly_goals = [
        goal
        for goal in (
            db.table("yearly_goals")
            .select("id")
            .eq("session_id", str(session_id))
            .eq("year", year)
            .execute()
            .data
            or []
        )
    ]
    monthly_goals = [
        goal
        for goal in (
            db.table("monthly_goals")
            .select("id,yearly_goal_id,month")
            .eq("session_id", str(session_id))
            .eq("year", year)
            .in_("month", list(months))
            .execute()
            .data
            or []
        )
    ]
    linked_monthly = sum(1 for goal in monthly_goals if goal.get("yearly_goal_id"))
    metrics = aggregate_quarterly_metrics(
        monthly_metrics,
        yearly_goals_total=len(monthly_goals) or len(yearly_goals),
        yearly_goals_linked=linked_monthly,
    )
    metrics["year"] = year
    metrics["quarter"] = quarter

    ai_narrative = {
        "summary": f"{_quarter_label(year, quarter)} spans {month_name(months[0])} to {month_name(months[-1])}.",
        "key_pattern": f"Average monthly completion settled at {metrics['avg_monthly_completion']}%.",
        "reflection": "This quarterly narrative was reconstructed from the saved monthly archive rather than a live AI generation pass.",
        "next_quarter_focus": f"Use {_quarter_label(year, quarter + 1) if quarter < 4 else _quarter_label(year + 1, 1)} to tighten one repeated execution leak instead of carrying every theme forward at once.",
    }
    return {"metrics": metrics, "ai_narrative": ai_narrative}
