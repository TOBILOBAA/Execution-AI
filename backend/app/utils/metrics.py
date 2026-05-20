"""
Pure Python metric computations.
No AI involved — deterministic aggregation used for reports and dashboard.

Canonical §9c metric keys persisted on `report_snapshots.metrics`:
  - completion       (0-100)
  - consistency      (0-100, habit-completion rate average)
  - alignment        (0-100, linked_children / total_children)
  - realism          (0-100, capped trajectory score)
  - momentum         (0-100, sub-period trend)
  - execution_score  (0-100, weighted blend per §9c)

The frontend never recomputes these — it reads them from the snapshot.
"""
from datetime import date
from typing import Any


def compute_completion_rate(completed: int, total: int) -> int:
    """Returns integer 0-100. Returns 0 if total is 0."""
    if total == 0:
        return 0
    return min(100, int((completed / total) * 100))


# ─── §9c canonical metrics ────────────────────────────────────────────────────


def _clamp_percent(value: float) -> int:
    return max(0, min(100, round(value)))


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def compute_alignment(linked_children: int, total_children: int) -> int:
    """
    Alignment % = linked_children / total_children.
    For monthly goals, "linked" means `yearly_goal_id IS NOT NULL`.
    Same shape applies to weekly→monthly and daily→weekly linkage.
    """
    if total_children == 0:
        return 0
    return _clamp_percent((linked_children / total_children) * 100)


def compute_realism(completion: int) -> int:
    """
    Realism % = min(100, completion / 80 * 100).
    Treats 80% completion as the realism target — rewards calibrated planning.
    """
    return _clamp_percent((completion / 80.0) * 100)


def compute_momentum(rates: list[int | float]) -> int:
    """
    Momentum % — trend slope of completion across sub-periods, normalized 0-100.

    Same shape the frontend used to compute (kept identical so historical
    snapshots and live reads agree): 60% trend signal + 40% most-recent window.
    A flat trend lands at ~50; improvement pushes higher; regression lower.
    """
    clean = [float(r) for r in rates if isinstance(r, (int, float)) and r == r]
    if not clean:
        return 0
    if len(clean) == 1:
        return _clamp_percent(clean[0])

    slice_size = max(1, -(-len(clean) // 3))  # ceil division
    baseline = _avg(clean[:slice_size])
    recent = _avg(clean[-slice_size:])
    trend_score = _clamp_percent(50 + (recent - baseline))
    return _clamp_percent(trend_score * 0.6 + recent * 0.4)


def compute_execution_score(
    completion: int,
    consistency: int,
    alignment: int,
    realism: int,
    momentum: int,
) -> int:
    """
    Execution score weights per §9c:
      30% completion + 25% consistency + 20% alignment + 10% realism + 15% momentum
    """
    return _clamp_percent(
        completion * 0.30
        + consistency * 0.25
        + alignment * 0.20
        + realism * 0.10
        + momentum * 0.15
    )


def build_canonical_metrics(
    *,
    completion: int,
    consistency: int,
    alignment: int,
    momentum_rates: list[int | float],
) -> dict[str, int]:
    """
    Single source of truth for the six §9c keys persisted on `report_snapshots`.
    Period-specific aggregations should call this and merge the result into
    their existing metrics dict.
    """
    completion_clamped = _clamp_percent(completion)
    consistency_clamped = _clamp_percent(consistency)
    alignment_clamped = _clamp_percent(alignment)
    realism = compute_realism(completion_clamped)
    momentum = compute_momentum(momentum_rates)
    execution_score = compute_execution_score(
        completion=completion_clamped,
        consistency=consistency_clamped,
        alignment=alignment_clamped,
        realism=realism,
        momentum=momentum,
    )
    return {
        "completion": completion_clamped,
        "consistency": consistency_clamped,
        "alignment": alignment_clamped,
        "realism": realism,
        "momentum": momentum,
        "execution_score": execution_score,
    }


def compute_weighted_daily_completion(
    priorities_completed: int,
    priorities_total: int,
    secondary_completed: int,
    secondary_total: int,
    habits_completed: int,
    habits_total: int,
) -> int:
    """
    Weighted daily completion:
      - priorities: 60% weight
      - secondary:  25% weight
      - habits:     15% weight
    """
    w_p = 0.60 * compute_completion_rate(priorities_completed, priorities_total)
    w_s = 0.25 * compute_completion_rate(secondary_completed, secondary_total)
    w_h = 0.15 * compute_completion_rate(habits_completed, habits_total)
    return int(w_p + w_s + w_h)


def compute_weekly_consistency(
    daily_completion_rates: list[int],  # list of 0-7 values (Mon-Sun), 0-100 each
) -> list[int]:
    """
    Pad or trim to exactly 7 values. Missing days → 0.
    """
    padded = (daily_completion_rates + [0] * 7)[:7]
    return padded


def compute_habit_streak(
    completion_history: list[tuple[date, bool]],
    frequency: str,
    ref: date | None = None,
    week_starts_on: str = "monday",
) -> int:
    """
    Compute consecutive streak for a habit.
    For daily habits: counts consecutive days completed ending today/yesterday.
    For weekly habits: counts consecutive weeks completed.
    """
    from datetime import timedelta

    today = ref or date.today()
    completed_dates = sorted(
        {d for d, done in completion_history if done}, reverse=True
    )
    if not completed_dates:
        return 0

    if frequency == "flexible":
        return 0

    if frequency == "daily":
        streak = 0
        expected = today
        for d in completed_dates:
            if d == expected:
                streak += 1
                expected = d - timedelta(days=1)
            elif d == today - timedelta(days=1) and streak == 0:
                streak += 1
                expected = d - timedelta(days=1)
            else:
                break
        return streak

    # weekly: count consecutive planning weeks using the configured week start
    from app.utils.date_utils import week_number_for

    current_week = week_number_for(today, week_starts_on)
    streak = 0
    expected_week = current_week
    for d in completed_dates:
        w = week_number_for(d, week_starts_on)
        if w == expected_week:
            streak += 1
            expected_week -= 1
        elif streak == 0 and w == current_week - 1:
            streak += 1
            expected_week = w - 1
        else:
            break
    return streak


def aggregate_daily_metrics(
    priorities: list[dict],
    secondary_tasks: list[dict],
    habits_completed: int,
    habits_total: int,
    *,
    alignment_linked: int | None = None,
    alignment_total: int | None = None,
    momentum_rates: list[int | float] | None = None,
) -> dict:
    priorities_total = len(priorities)
    priorities_completed = sum(1 for p in priorities if p.get("completed"))
    secondary_total = len(secondary_tasks)
    secondary_completed = sum(1 for t in secondary_tasks if t.get("completed"))
    est_planned = sum(p.get("estimated_minutes", 0) or 0 for p in priorities + secondary_tasks)
    est_completed = sum(
        p.get("estimated_minutes", 0) or 0
        for p in (priorities + secondary_tasks)
        if p.get("completed")
    )

    completion_rate = compute_weighted_daily_completion(
        priorities_completed, priorities_total,
        secondary_completed, secondary_total,
        habits_completed, habits_total,
    )
    consistency = compute_completion_rate(habits_completed, habits_total)
    # Daily alignment defaults to priority→weekly-goal linkage if caller supplies counts.
    align_total = priorities_total if alignment_total is None else alignment_total
    align_linked = priorities_total if alignment_linked is None else alignment_linked
    alignment = compute_alignment(align_linked, align_total)
    canonical = build_canonical_metrics(
        completion=completion_rate,
        consistency=consistency,
        alignment=alignment,
        momentum_rates=momentum_rates or [completion_rate],
    )

    return {
        "priorities_total": priorities_total,
        "priorities_completed": priorities_completed,
        "secondary_tasks_total": secondary_total,
        "secondary_tasks_completed": secondary_completed,
        "habits_total": habits_total,
        "habits_completed": habits_completed,
        "completion_rate": completion_rate,
        "estimated_minutes_planned": est_planned,
        "estimated_minutes_completed": est_completed,
        **canonical,
    }


def aggregate_weekly_metrics(
    weekly_goals: list[dict],
    daily_summaries: list[dict],  # list of daily metric dicts
) -> dict:
    goals_total = len(weekly_goals)
    goals_completed = sum(1 for g in weekly_goals if g.get("status") == "completed")
    main_total = sum(1 for g in weekly_goals if g.get("is_main"))
    main_completed = sum(
        1 for g in weekly_goals if g.get("is_main") and g.get("status") == "completed"
    )
    tasks_total = sum(d.get("priorities_total", 0) + d.get("secondary_tasks_total", 0) for d in daily_summaries)
    tasks_completed = sum(d.get("priorities_completed", 0) + d.get("secondary_tasks_completed", 0) for d in daily_summaries)
    habit_rates = [d.get("habits_completed", 0) / max(d.get("habits_total", 1), 1) for d in daily_summaries]
    habit_consistency = int(sum(habit_rates) / max(len(habit_rates), 1) * 100)

    daily_completion_values = [d.get("completion_rate", 0) for d in daily_summaries]
    avg_daily = int(sum(daily_completion_values) / max(len(daily_completion_values), 1))

    # §9c alignment for weekly: weekly goals linked to a monthly goal.
    linked_weekly = sum(1 for g in weekly_goals if g.get("monthly_goal_id"))
    alignment = compute_alignment(linked_weekly, goals_total)
    canonical = build_canonical_metrics(
        completion=avg_daily,
        consistency=habit_consistency,
        alignment=alignment,
        momentum_rates=daily_completion_values,
    )

    return {
        "goals_total": goals_total,
        "goals_completed": goals_completed,
        "main_goals_total": main_total,
        "main_goals_completed": main_completed,
        "tasks_total": tasks_total,
        "tasks_completed": tasks_completed,
        "avg_daily_completion": avg_daily,
        "habit_consistency": habit_consistency,
        "days_with_data": len(daily_summaries),
        **canonical,
    }


def aggregate_monthly_metrics(
    monthly_goals: list[dict],
    weekly_summaries: list[dict],
    category_map: dict[str, str] | None = None,
) -> dict:
    goals_total = len(monthly_goals)
    goals_completed = sum(1 for g in monthly_goals if g.get("status") == "completed")
    main_total = sum(1 for g in monthly_goals if g.get("is_main"))
    main_completed = sum(
        1 for g in monthly_goals if g.get("is_main") and g.get("status") == "completed"
    )
    tasks_total = sum(w.get("tasks_total", 0) for w in weekly_summaries)
    tasks_completed = sum(w.get("tasks_completed", 0) for w in weekly_summaries)
    weekly_rates = [w.get("avg_daily_completion", 0) for w in weekly_summaries]
    avg_weekly = int(sum(weekly_rates) / max(len(weekly_rates), 1))
    best_week = None
    if weekly_summaries:
        best = max(weekly_summaries, key=lambda w: w.get("avg_daily_completion", 0))
        best_week = best.get("week_number")

    # §9c alignment for monthly: monthly goals linked to a yearly goal.
    linked_monthly = sum(1 for g in monthly_goals if g.get("yearly_goal_id"))
    alignment = compute_alignment(linked_monthly, goals_total)
    consistency_values = [w.get("habit_consistency", 0) for w in weekly_summaries]
    consistency = int(sum(consistency_values) / max(len(consistency_values), 1))
    canonical = build_canonical_metrics(
        completion=avg_weekly,
        consistency=consistency,
        alignment=alignment,
        momentum_rates=weekly_rates,
    )

    return {
        "goals_total": goals_total,
        "goals_completed": goals_completed,
        "main_goals_total": main_total,
        "main_goals_completed": main_completed,
        "tasks_total": tasks_total,
        "tasks_completed": tasks_completed,
        "avg_weekly_completion": avg_weekly,
        "best_week": best_week,
        "weeks_count": len(weekly_summaries),
        **canonical,
    }


def aggregate_quarterly_metrics(
    monthly_summaries: list[dict],
    yearly_goals_total: int = 0,
    yearly_goals_linked: int = 0,
) -> dict:
    """
    Aggregate three monthly summaries into a quarterly view.
    Alignment for the quarterly view rolls up monthly→yearly linkage rates.
    """
    tasks_total = sum(m.get("tasks_total", 0) for m in monthly_summaries)
    tasks_completed = sum(m.get("tasks_completed", 0) for m in monthly_summaries)
    monthly_rates = [m.get("avg_weekly_completion", 0) for m in monthly_summaries if m.get("tasks_total", 0) > 0]
    avg_monthly = int(sum(monthly_rates) / max(len(monthly_rates), 1))
    consistency_values = [m.get("consistency", 0) for m in monthly_summaries]
    consistency = int(sum(consistency_values) / max(len(consistency_values), 1))

    alignment = compute_alignment(yearly_goals_linked, yearly_goals_total or 0)
    canonical = build_canonical_metrics(
        completion=avg_monthly,
        consistency=consistency,
        alignment=alignment,
        momentum_rates=monthly_rates,
    )

    return {
        "tasks_total": tasks_total,
        "tasks_completed": tasks_completed,
        "avg_monthly_completion": avg_monthly,
        "months_count": len(monthly_summaries),
        **canonical,
    }


def aggregate_yearly_metrics(
    monthly_summaries: list[dict],
    execution_streak: int = 0,
    previous_year_completion: int | None = None,
) -> dict:
    tasks_total = sum(m.get("tasks_total", 0) for m in monthly_summaries)
    tasks_completed = sum(m.get("tasks_completed", 0) for m in monthly_summaries)
    monthly_rates = [m.get("avg_weekly_completion", 0) for m in monthly_summaries if m.get("tasks_total", 0) > 0]
    avg_monthly = int(sum(monthly_rates) / max(len(monthly_rates), 1))
    best_month = None
    if monthly_summaries:
        active = [m for m in monthly_summaries if m.get("tasks_total", 0) > 0]
        if active:
            best = max(active, key=lambda m: m.get("avg_weekly_completion", 0))
            best_month = best.get("month")

    pct_change = None
    if previous_year_completion is not None and previous_year_completion > 0:
        pct_change = int(((avg_monthly - previous_year_completion) / previous_year_completion) * 100)

    consistency_values = [m.get("consistency", 0) for m in monthly_summaries]
    consistency = int(sum(consistency_values) / max(len(consistency_values), 1))
    alignment_values = [m.get("alignment", 0) for m in monthly_summaries if m.get("alignment") is not None]
    alignment = int(sum(alignment_values) / max(len(alignment_values), 1)) if alignment_values else 0
    canonical = build_canonical_metrics(
        completion=avg_monthly,
        consistency=consistency,
        alignment=alignment,
        momentum_rates=monthly_rates,
    )

    return {
        "months_with_data": len(monthly_rates),
        "tasks_total": tasks_total,
        "tasks_completed": tasks_completed,
        "avg_monthly_completion": avg_monthly,
        "best_month": best_month,
        "execution_streak": execution_streak,
        "percent_change": pct_change,
        **canonical,
    }
