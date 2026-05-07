"""
Gemini integration via Google AI Studio API key.

Responsibilities:
- Build structured prompts with temporal context + planning payload
- Request JSON-structured responses
- Validate output against Pydantic schemas
- Retry on malformed output (up to 2 retries)
- Log generation metadata
- Keep model swappable

The AI layer knows nothing about the database.
It receives structured input and returns structured output.
"""
import json
import os
import time
from typing import TypeVar, Type
from pydantic import BaseModel, ValidationError

from google import genai
from google.genai import types as genai_types

from app.core.config import get_settings
from app.core.logging import logger
from app.schemas.reports import (
    AIMonthlyPlanOutput,
    AIWeeklyPlanOutput,
    AIDailyPlanOutput,
    DailyNarrative,
    WeeklyNarrative,
    MonthlyNarrative,
    QuarterlyNarrative,
    YearlyNarrative,
)

T = TypeVar("T", bound=BaseModel)

_client: genai.Client | None = None
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
MODEL_FALLBACKS: dict[str, str] = {
    "gemini-2.0-flash": "gemini-2.5-flash",
    "gemini-2.0-flash-001": "gemini-2.5-flash",
    "gemini-2.0-flash-lite": "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite-001": "gemini-2.5-flash-lite",
}

# Dev-mode prompt logging — set APP_ENV=development to enable
_LOG_PROMPTS = os.getenv("APP_ENV", "production").lower() in ("development", "dev")


def _log_prompt(tag: str, prompt: str) -> None:
    if _LOG_PROMPTS:
        logger.debug("ai_prompt", tag=tag, prompt=prompt[:2000])


def _normalize_model_id(name: str) -> str:
    """Strip any accidental `models/` prefix so AI Studio accepts the id."""
    n = (name or "").strip()
    if n.startswith("models/"):
        return n[7:]
    return n or DEFAULT_GEMINI_MODEL


def _get_client() -> genai.Client:
    """
    Returns a Google AI Studio-backed google-genai client.
    """
    global _client
    if _client is not None:
        return _client

    settings = get_settings()
    if not settings.google_ai_api_key:
        raise RuntimeError(
            "GOOGLE_AI_API_KEY is required for AI planning/report features. "
            "Set it in backend/.env or your deployed backend environment."
        )

    http_options = genai_types.HttpOptions(timeout=settings.gemini_request_timeout_ms)

    _client = genai.Client(
        api_key=settings.google_ai_api_key,
        http_options=http_options,
    )
    logger.info("gemini_client_mode", mode="google_ai_studio")

    return _client


def _is_unavailable_model_error(error: Exception) -> bool:
    message = str(error).lower()
    return "not_found" in message or "no longer available" in message


def _call_gemini_with_model(
    client: genai.Client,
    model_id: str,
    prompt: str,
    max_retries: int,
    max_output_tokens: int,
) -> str:
    config = genai_types.GenerateContentConfig(
        temperature=0.4,
        top_p=0.95,
        max_output_tokens=min(8192, max(512, max_output_tokens)),
        response_mime_type="application/json",
    )

    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            start = time.monotonic()
            response = client.models.generate_content(
                model=model_id,
                contents=prompt,
                config=config,
            )
            latency_ms = int((time.monotonic() - start) * 1000)
            text = response.text.strip() if response.text else ""
            if not text:
                raise ValueError("Empty response from Gemini")
            logger.info(
                "gemini_response",
                latency_ms=latency_ms,
                attempt=attempt,
                model=model_id,
            )
            return text
        except Exception as exc:
            last_error = exc
            logger.warning("gemini_retry", attempt=attempt, error=str(exc), model=model_id)
            if attempt < max_retries:
                time.sleep(0.35 * (attempt + 1))

    raise RuntimeError(f"Gemini call failed after {max_retries + 1} attempts: {last_error}")


def _call_gemini(prompt: str, max_retries: int = 1) -> str:
    """
    Call Gemini via the google-genai SDK with JSON output mode.
    Retries on empty/failed responses. Returns raw text content.
    """
    settings = get_settings()
    client = _get_client()
    model_id = _normalize_model_id(settings.gemini_model)
    try:
        return _call_gemini_with_model(
            client,
            model_id,
            prompt,
            max_retries=max_retries,
            max_output_tokens=settings.gemini_max_output_tokens,
        )
    except RuntimeError as exc:
        fallback_model = MODEL_FALLBACKS.get(model_id)
        if not fallback_model or not _is_unavailable_model_error(exc):
            raise
        logger.warning(
            "gemini_model_fallback",
            from_model=model_id,
            to_model=fallback_model,
            error=str(exc),
        )
        return _call_gemini_with_model(
            client,
            fallback_model,
            prompt,
            max_retries=max_retries,
            max_output_tokens=settings.gemini_max_output_tokens,
        )


def _parse_and_validate(raw: str, schema: Type[T]) -> T:
    """Parse JSON string and validate against a Pydantic schema."""
    try:
        data = json.loads(raw)
        return schema.model_validate(data)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise ValueError(f"AI output failed validation: {exc}\nRaw: {raw[:400]}") from exc


# ─── System role ──────────────────────────────────────────────────────────────

_SYSTEM_ROLE = """You are an elite execution strategist AI embedded in a productivity platform called Execution AI.
Your job is to produce structured, realistic, actionable planning output.
You must:
- Respect the workload budget given to you (max goals, max tasks)
- Align outputs with the parent goals provided
- Account for the temporal context (days remaining, late in month/week, etc.)
- Return ONLY valid JSON matching the exact schema requested
- Be concise and specific — not generic or vague
- Never invent goals that contradict the user's stated intentions"""

_GENERIC_COPY_NEGATIVES = """Forbidden phrasings — never produce these:
- "Great job", "Well done", "Keep it up", "You're doing great", "Amazing work"
- "Stay focused", "Keep going", "One step at a time"
- Any motivational-poster cliche
- Any generic prescription like "be more consistent"

Output must be honest, specific, and grounded in the evidence provided.
Lead with names + numbers when possible.
No questions. No cheerleading. No advice outside the execution lane.
`tailored_pattern` must name a real pattern visible in the execution diary.
`tailored_action` must directly respond to that exact pattern."""


def _json_block(data: object) -> str:
    return json.dumps(data, indent=2, ensure_ascii=True)


def _report_context_block(
    goal_context: dict | None,
    execution_diary: dict | None,
    *,
    yearly_key: str,
    monthly_key: str,
    weekly_key: str,
) -> str:
    context = goal_context or {}
    diary = execution_diary or {}
    return f"""### Goal Hierarchy Context
Yearly goals:
{_json_block(context.get(yearly_key, []))}

Monthly goals:
{_json_block(context.get(monthly_key, []))}

Weekly goals:
{_json_block(context.get(weekly_key, []))}

Active habits:
{_json_block(context.get("active_habits", []))}

### Execution Diary (structured evidence)
{_json_block(diary)}"""


# ─── Monthly Plan Generation ──────────────────────────────────────────────────

def generate_monthly_plan(planning_payload: dict) -> AIMonthlyPlanOutput:
    """
    Generate a realistic monthly plan from yearly goals and temporal context.
    Returns validated AIMonthlyPlanOutput.
    """
    ctx = planning_payload["temporal_context"]
    budget = planning_payload["workload_budget"]
    yearly_goals = planning_payload["yearly_goals"]

    goals_text = "\n".join(
        f"- [{g['category']}] {g['title']} (progress: {g.get('progress_pct', 0)}%)"
        f"{(' — ' + g['description']) if g.get('description') else ''}"
        f"{(' | target: ' + g['target_date']) if g.get('target_date') else ''}"
        for g in yearly_goals
    )

    prompt = f"""{_SYSTEM_ROLE}

## Task: Generate Monthly Plan

### Temporal Context
- Month: {ctx['month']} {ctx['year']}
- Days remaining in month: {ctx['days_remaining']} of {ctx['days_in_month']}
- Month progress: {ctx['month_progress_pct']}%
- Late in month: {ctx['is_late_in_month']}

### Workload Budget
- Max main goals: {budget['max_main_goals']}
- Max secondary goals: {budget['max_secondary_goals']}
- Workload label: {budget['workload_label']}
- Rationale: {budget['rationale']}

### Yearly Goals (parent context)
{goals_text}

### Instructions
Generate ONLY main_goals and secondary_goals for this month. Do NOT suggest foundational habits — users define those separately in the app.
Never return more than {budget['max_main_goals']} main_goals or more than {budget['max_secondary_goals']} secondary_goals.
Goals must be achievable within the remaining {ctx['days_remaining']} days.
Each goal must set yearly_goal_ref to the exact title of a yearly goal above when possible.
For EVERY goal, set target_date to a realistic deadline as YYYY-MM-DD within {ctx['year']}-{ctx['month']:02d} (use dates on or after today if this is the current month).

### Required JSON Output Schema
{{
  "reasoning": "<brief explanation of your planning decisions>",
  "main_goals": [
    {{
      "title": "<specific, achievable goal>",
      "description": "<1-2 sentence description>",
      "priority": "high",
      "is_main": true,
      "yearly_goal_ref": "<title of the yearly goal this serves>",
      "estimated_effort": "<e.g. 10-15 hours total>",
      "target_date": "<YYYY-MM-DD within this month>"
    }}
  ],
  "secondary_goals": [
    {{
      "title": "<supporting goal>",
      "description": "<1-2 sentence description>",
      "priority": "medium",
      "is_main": false,
      "yearly_goal_ref": "<yearly goal ref or null>",
      "estimated_effort": "<estimate>",
      "target_date": "<YYYY-MM-DD within this month>"
    }}
  ]
}}

Return ONLY valid JSON. No markdown. No extra text."""

    _log_prompt("monthly_plan", prompt)
    raw = _call_gemini(prompt)
    parsed = _parse_and_validate(raw, AIMonthlyPlanOutput)
    return parsed.model_copy(update={"foundational_habits": []})


# ─── Weekly Plan Generation ───────────────────────────────────────────────────

def generate_weekly_plan(planning_payload: dict) -> AIWeeklyPlanOutput:
    ctx = planning_payload["temporal_context"]
    budget = planning_payload["workload_budget"]
    monthly_goals = planning_payload["monthly_goals"]
    yearly_goals = planning_payload.get("yearly_goals", [])

    monthly_text = "\n".join(
        f"- [{'MAIN' if g['is_main'] else 'secondary'}] {g['title']} (progress: {g.get('progress_pct', 0)}%)"
        f"{(' | workload: ' + g['workload']) if g.get('workload') else ''}"
        f"{(' — ' + g['description']) if g.get('description') else ''}"
        for g in monthly_goals
    )

    yearly_text = "\n".join(
        f"- {g['title']} (progress: {g.get('progress_pct', 0)}%)"
        f"{(' — ' + g['description']) if g.get('description') else ''}"
        for g in yearly_goals
    ) or "No yearly goals provided."

    prompt = f"""{_SYSTEM_ROLE}

## Task: Generate Weekly Plan

### Temporal Context
- Week: {ctx['week_number']} ({ctx['week_start']} to {ctx['week_end']})
- Days remaining in week: {ctx['days_remaining']}
- Week progress: {ctx['week_progress_pct']}%
- Late in week: {ctx['is_late_in_week']}
- Month: {ctx['month']} {ctx['year']}

### Workload Budget
- Max main goals: {budget['max_main_goals']}
- Max secondary goals: {budget['max_secondary_goals']}
- Workload label: {budget['workload_label']}
- Rationale: {budget['rationale']}

### Monthly Goals (immediate parent)
{monthly_text}

### Yearly Goals (strategic context)
{yearly_text}

### Instructions
Generate ONLY main_goals and secondary_goals for this week. Do NOT suggest foundational habits — users define those in the app.
Never return more than {budget['max_main_goals']} main_goals or more than {budget['max_secondary_goals']} secondary_goals.
Each goal must be completable within {ctx['days_remaining']} days.
Weekly goals must concretely advance the monthly goals above. Set yearly_goal_ref to the monthly goal title when applicable.

### Required JSON Output Schema
{{
  "reasoning": "<brief planning rationale>",
  "main_goals": [
    {{
      "title": "<specific weekly deliverable>",
      "description": "<1-2 sentences>",
      "priority": "high",
      "is_main": true,
      "yearly_goal_ref": "<monthly goal title this serves>",
      "estimated_effort": "<hours estimate>"
    }}
  ],
  "secondary_goals": [
    {{
      "title": "<supporting task>",
      "description": "<1-2 sentences>",
      "priority": "medium",
      "is_main": false,
      "yearly_goal_ref": null,
      "estimated_effort": "<estimate>"
    }}
  ]
}}

Return ONLY valid JSON."""

    _log_prompt("weekly_plan", prompt)
    raw = _call_gemini(prompt)
    parsed = _parse_and_validate(raw, AIWeeklyPlanOutput)
    return parsed.model_copy(update={"foundational_habits": []})


# ─── Daily Plan Generation ────────────────────────────────────────────────────

def generate_daily_plan(planning_payload: dict) -> AIDailyPlanOutput:
    ctx = planning_payload["temporal_context"]
    budget = planning_payload["workload_budget"]
    weekly_goals = planning_payload["weekly_goals"]
    monthly_goals = planning_payload.get("monthly_goals", [])
    yearly_goals = planning_payload.get("yearly_goals", [])
    habits = planning_payload.get("active_habits", [])
    remaining = planning_payload.get("weekly_tasks_remaining", 0)
    yesterday = planning_payload.get("yesterday_completion", {})

    weekly_text = "\n".join(
        f"- [{'MAIN' if g['is_main'] else 'secondary'}] {g['title']} (progress: {g.get('progress_pct', 0)}%)"
        f"{(' — ' + g['description']) if g.get('description') else ''}"
        for g in weekly_goals
    )
    monthly_text = "\n".join(
        f"- [{'MAIN' if g['is_main'] else 'secondary'}] {g['title']} (progress: {g.get('progress_pct', 0)}%)"
        f"{(' | workload: ' + g['workload']) if g.get('workload') else ''}"
        for g in monthly_goals
    ) or "No monthly goals."
    yearly_text = "\n".join(
        f"- {g['title']} ({g.get('progress_pct', 0)}%)"
        for g in yearly_goals
    ) or "No yearly goals."
    habits_text = ", ".join(habits) if habits else "none set"

    yesterday_text = ""
    if yesterday:
        y_rate = yesterday.get("completion_rate", "N/A")
        y_done = yesterday.get("priorities_completed", 0)
        y_total = yesterday.get("priorities_total", 0)
        yesterday_text = f"\n### Yesterday's Completion\n- Completion rate: {y_rate}%\n- Priorities: {y_done}/{y_total}"

    prompt = f"""{_SYSTEM_ROLE}

## Task: Generate Daily Plan

### Temporal Context
- Today: {ctx['today']} ({ctx['day_of_week']})
- Days remaining in week: {ctx['days_remaining_in_week']}
- Days remaining in month: {ctx['days_remaining_in_month']}
- Late in week: {ctx['is_late_in_week']}

### Workload Budget
- Max priorities: {budget['max_daily_priorities']}
- Max secondary tasks: {budget['max_secondary_tasks']}
- Workload label: {budget['workload_label']}
- Rationale: {budget['rationale']}

### Weekly Goals (immediate parent)
{weekly_text}
Weekly tasks remaining: {remaining}

### Monthly Goals (strategic context)
{monthly_text}

### Yearly Goals (long-range context)
{yearly_text}
{yesterday_text}

### Active Habits to reinforce today
{habits_text}

### Instructions
Generate a daily plan for {ctx['today']}. Priorities must be concretely achievable in one day.
Never return more than {budget['max_daily_priorities']} top_priorities or more than {budget['max_secondary_tasks']} secondary_tasks.
Each priority should advance a specific weekly goal. Secondary tasks are quick wins or maintenance.
Do NOT include foundational_habits in the output — they are tracked separately in the app.

### Required JSON Output Schema
{{
  "reasoning": "<planning rationale for today>",
  "top_priorities": [
    {{
      "title": "<concrete task for today>",
      "description": "<specific action>",
      "priority": "high",
      "is_main": true,
      "yearly_goal_ref": "<weekly goal title>",
      "estimated_effort": "<minutes, e.g. 90 min>"
    }}
  ],
  "secondary_tasks": [
    {{
      "title": "<quick win or maintenance task>",
      "description": null,
      "priority": "medium",
      "is_main": false,
      "yearly_goal_ref": null,
      "estimated_effort": "<minutes>"
    }}
  ]
}}

Return ONLY valid JSON."""

    _log_prompt("daily_plan", prompt)

    raw = _call_gemini(prompt)
    return _parse_and_validate(raw, AIDailyPlanOutput)


# ─── Daily Report Generation ──────────────────────────────────────────────────

def generate_daily_report(
    metrics: dict,
    date_str: str,
    goal_context: dict | None = None,
    execution_diary: dict | None = None,
) -> DailyNarrative:
    prompt = f"""{_SYSTEM_ROLE}

## Task: Generate Daily Execution Report

### Date: {date_str}

### Metrics (computed by code — do not recalculate)
- Priorities completed: {metrics['priorities_completed']} / {metrics['priorities_total']}
- Secondary tasks completed: {metrics['secondary_tasks_completed']} / {metrics['secondary_tasks_total']}
- Habits completed: {metrics['habits_completed']} / {metrics['habits_total']}
- Overall completion rate: {metrics['completion_rate']}%
- Estimated minutes planned: {metrics['estimated_minutes_planned']}
- Estimated minutes completed: {metrics['estimated_minutes_completed']}

{_report_context_block(
    goal_context,
    execution_diary,
    yearly_key="yearly_goals_summary",
    monthly_key="monthly_goals_summary",
    weekly_key="weekly_goals_full",
)}

### Instructions
Write a brief, honest, insight-driven daily reflection. Be direct. Avoid corporate filler.
Identify the top win and the key miss if applicable. Give one concrete focus for tomorrow.

### Required JSON Output Schema
{{
  "summary": "<2-3 sentence day summary>",
  "top_win": "<best achievement of the day or null>",
  "key_miss": "<biggest miss or null>",
  "reflection": "<honest reflection on patterns or blockers>",
  "tomorrow_focus": "<single most important focus for tomorrow>"
}}

Return ONLY valid JSON."""

    _log_prompt("daily_report", prompt)
    raw = _call_gemini(prompt)
    return _parse_and_validate(raw, DailyNarrative)


# ─── Weekly Report Generation ─────────────────────────────────────────────────

def generate_weekly_report(
    metrics: dict,
    week_label: str,
    goal_context: dict | None = None,
    execution_diary: dict | None = None,
) -> WeeklyNarrative:
    prompt = f"""{_SYSTEM_ROLE}

## Task: Generate Weekly Execution Report

### Week: {week_label}

### Metrics (computed by code)
- Goals completed: {metrics['goals_completed']} / {metrics['goals_total']}
- Main goals completed: {metrics['main_goals_completed']} / {metrics['main_goals_total']}
- Tasks completed: {metrics['tasks_completed']} / {metrics['tasks_total']}
- Avg daily completion: {metrics['avg_daily_completion']}%
- Habit consistency: {metrics['habit_consistency']}%
- Days with data: {metrics['days_with_data']}

{_report_context_block(
    goal_context,
    execution_diary,
    yearly_key="yearly_goals_summary",
    monthly_key="monthly_goals_full",
    weekly_key="weekly_goals_full",
)}

### Instructions
{_GENERIC_COPY_NEGATIVES}

### Required JSON Output Schema
{{
  "summary": "<2-3 sentence week summary grounded in the data above>",
  "top_win": "<best achievement of the week or null>",
  "key_pattern": "<observed pattern — positive or negative>",
  "reflection": "<honest weekly reflection>",
  "next_week_priority": "<single most important focus for next week>",
  "tailored_pattern": "<specific behavioral pattern from this user's execution diary>",
  "tailored_action": "<one concrete recommendation based on that pattern>"
}}

Return ONLY valid JSON."""

    _log_prompt("weekly_report", prompt)
    raw = _call_gemini(prompt)
    return _parse_and_validate(raw, WeeklyNarrative)


# ─── Monthly Report Generation ────────────────────────────────────────────────

def generate_monthly_report(
    metrics: dict,
    month_label: str,
    goal_context: dict | None = None,
    execution_diary: dict | None = None,
) -> MonthlyNarrative:
    prompt = f"""{_SYSTEM_ROLE}

## Task: Generate Monthly Execution Report

### Month: {month_label}

### Metrics (computed by code)
- Goals completed: {metrics['goals_completed']} / {metrics['goals_total']}
- Main goals completed: {metrics['main_goals_completed']} / {metrics['main_goals_total']}
- Tasks completed: {metrics['tasks_completed']} / {metrics['tasks_total']}
- Avg weekly completion: {metrics['avg_weekly_completion']}%
- Best week: Week {metrics.get('best_week', 'N/A')}
- Weeks tracked: {metrics['weeks_count']}

{_report_context_block(
    goal_context,
    execution_diary,
    yearly_key="yearly_goals_full",
    monthly_key="monthly_goals_full",
    weekly_key="weekly_goals_summary",
)}

### Instructions
{_GENERIC_COPY_NEGATIVES}

### Required JSON Output Schema
{{
  "summary": "<2-3 sentence month summary grounded in the data above>",
  "top_pillar": "<strongest category/area this month or null>",
  "biggest_win": "<most impactful achievement>",
  "key_lesson": "<most important lesson learned>",
  "reflection": "<honest monthly reflection>",
  "next_month_focus": "<strategic priority for next month>",
  "tailored_pattern": "<specific behavioral pattern from this user's data>",
  "tailored_action": "<one concrete recommendation based on that pattern>"
}}

Return ONLY valid JSON."""

    _log_prompt("monthly_report", prompt)
    raw = _call_gemini(prompt)
    return _parse_and_validate(raw, MonthlyNarrative)


# ─── Quarterly Report Generation ──────────────────────────────────────────────

def generate_quarterly_report(
    metrics: dict,
    quarter_label: str,
    goal_context: dict | None = None,
    execution_diary: dict | None = None,
) -> QuarterlyNarrative:
    prompt = f"""{_SYSTEM_ROLE}

## Task: Generate Quarterly Execution Report

### Quarter: {quarter_label}

### Metrics (computed by code)
- Tasks completed: {metrics['tasks_completed']} / {metrics['tasks_total']}
- Avg monthly completion: {metrics['avg_monthly_completion']}%
- Months tracked: {metrics['months_count']}
- Completion: {metrics['completion']}%
- Consistency: {metrics['consistency']}%
- Alignment: {metrics['alignment']}%
- Realism: {metrics['realism']}%
- Momentum: {metrics['momentum']}%
- Execution score: {metrics['execution_score']}%

{_report_context_block(
    goal_context,
    execution_diary,
    yearly_key="yearly_goals_full",
    monthly_key="monthly_goals_full",
    weekly_key="weekly_goals_summary",
)}

### Instructions
{_GENERIC_COPY_NEGATIVES}

### Required JSON Output Schema
{{
  "summary": "<2-3 sentence quarter summary>",
  "key_pattern": "<dominant behavioral or execution pattern in this quarter>",
  "reflection": "<honest quarterly reflection>",
  "next_quarter_focus": "<single concrete focus for next quarter>",
  "tailored_pattern": "<specific behavioral pattern from this user's quarterly data>",
  "tailored_action": "<one concrete recommendation based on that pattern>"
}}

Return ONLY valid JSON."""

    _log_prompt("quarterly_report", prompt)
    raw = _call_gemini(prompt)
    return _parse_and_validate(raw, QuarterlyNarrative)


# ─── Yearly Report Generation ─────────────────────────────────────────────────

def generate_yearly_report(
    metrics: dict,
    year: int,
    goal_context: dict | None = None,
    execution_diary: dict | None = None,
) -> YearlyNarrative:
    prompt = f"""{_SYSTEM_ROLE}

## Task: Generate Yearly Execution Report

### Year: {year}

### Metrics (computed by code)
- Months with data: {metrics['months_with_data']}
- Tasks completed: {metrics['tasks_completed']} / {metrics['tasks_total']}
- Avg monthly completion: {metrics['avg_monthly_completion']}%
- Best month: {metrics.get('best_month', 'N/A')}
- Execution streak: {metrics['execution_streak']} days
- Year-over-year change: {metrics.get('percent_change', 'N/A')}%

{_report_context_block(
    goal_context,
    execution_diary,
    yearly_key="yearly_goals_full",
    monthly_key="monthly_goals_full",
    weekly_key="weekly_goals_summary",
)}

### Instructions
{_GENERIC_COPY_NEGATIVES}

### Required JSON Output Schema
{{
  "summary": "<2-3 sentence year summary grounded in the data above>",
  "top_pillar": "<strongest area this year>",
  "biggest_win": "<most impactful achievement of the year>",
  "key_pattern": "<dominant behavioral or execution pattern>",
  "reflection": "<honest yearly reflection>",
  "next_year_focus": "<strategic direction for next year>",
  "tailored_pattern": "<specific behavioral pattern from this user's annual data>",
  "tailored_action": "<one concrete recommendation based on that pattern>"
}}

Return ONLY valid JSON."""

    _log_prompt("yearly_report", prompt)
    raw = _call_gemini(prompt)
    return _parse_and_validate(raw, YearlyNarrative)
