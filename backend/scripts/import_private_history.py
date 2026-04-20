#!/usr/bin/env python3
"""
Private historical importer for a single user's notes.

Workflow:
1. Preview mode (default): parse raw notes, chunk internally, infer structure,
   and print a reviewable summary / JSON.
2. Apply mode: write the parsed records into the target user's workspace.

This is intentionally private/admin-oriented first. The public product UX can
be built later around the same parsing and preview concepts.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable

from app.core.config import get_settings
from app.db.client import get_supabase
import app.db.categories as categories_db
import app.db.habits as habits_db
import app.db.plans as plans_db
import app.db.sessions as sessions_db
import app.db.yearly_goals as yearly_goals_db
from app.utils.date_utils import get_week_boundaries, resolve_week_starts_on, week_number_for


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

WEEKDAY_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

CATEGORY_DEFS = [
    {
        "name": "Spiritual Life",
        "icon": "auto_stories",
        "color": "#006c4a",
        "keywords": {
            "god", "prayer", "pray", "bible", "worship", "sermon", "church",
            "fasting", "spiritual", "scriptures", "study the bible", "time with god",
            "kehila", "bro ola", "kingdom", "tongues", "holy spirit",
        },
    },
    {
        "name": "Relationship & Marriage",
        "icon": "favorite",
        "color": "#b45309",
        "keywords": {
            "marriage", "courtship", "spouse", "partner", "lara", "kasope",
            "relationship", "dating",
        },
    },
    {
        "name": "Career & AI",
        "icon": "neurology",
        "color": "#2563eb",
        "keywords": {
            "ai", "ml", "aws", "linkedin", "cto", "internship", "job", "museai",
            "evaluation ai", "prototype", "frontend", "back end", "backend",
            "architecture", "product", "workflow", "testing", "bugs", "hr project",
            "competency", "pipeline", "simulation", "dbcollection",
        },
    },
    {
        "name": "Academics & Research",
        "icon": "school",
        "color": "#92400e",
        "keywords": {
            "thesis", "assignment", "paper", "archive", "ofek", "arieh", "maya",
            "alon", "kobi", "research", "israeli studies", "seminar", "class",
            "vocabulary", "graduate program", "proposal", "presentation",
        },
    },
    {
        "name": "Worship & Music",
        "icon": "music_note",
        "color": "#c026d3",
        "keywords": {
            "piano", "song", "music", "chord", "instrumental", "worship team",
            "lyrics", "waveform", "plugin", "mix", "eq", "vst", "drum", "vocal",
            "voice training", "podcast", "daw",
        },
    },
    {
        "name": "Hebrew & Language",
        "icon": "translate",
        "color": "#0f766e",
        "keywords": {
            "hebrew", "vocabulary", "grammar", "reading", "pronoun test",
            "lord’s prayer", "lords prayer", "speaking", "writing",
        },
    },
    {
        "name": "Health & Fitness",
        "icon": "fitness_center",
        "color": "#dc2626",
        "keywords": {"workout", "physique", "stretches", "fitness"},
    },
    {
        "name": "Discipline & Planning",
        "icon": "checklist",
        "color": "#475569",
        "keywords": {
            "plan for tomorrow", "plan for the week", "discipline", "accountability",
            "template", "tracking", "study plan", "clock in",
        },
    },
    {
        "name": "Admin & Life",
        "icon": "event_note",
        "color": "#64748b",
        "keywords": {
            "meeting", "message", "schedule", "drivers license", "inquiry",
            "contact", "nudge", "send", "wish", "pray with", "community prayer",
        },
    },
]

MONTHLY_TITLES = {
    "Spiritual Life": "Spiritual consistency and growth",
    "Relationship & Marriage": "Relationship and marriage growth",
    "Career & AI": "Career and AI execution",
    "Academics & Research": "Academic and research progress",
    "Worship & Music": "Music and worship development",
    "Hebrew & Language": "Hebrew language progress",
    "Health & Fitness": "Health and fitness consistency",
    "Discipline & Planning": "Execution discipline and planning",
    "Admin & Life": "Life admin and coordination",
}

CANONICAL_HABIT_META = {
    "Worship, prayer, and Bible study": ("Spiritual Life", "daily"),
    "Workout": ("Health & Fitness", "daily"),
    "Lara follow-up": ("Relationship & Marriage", "daily"),
    "Hebrew study": ("Hebrew & Language", "daily"),
    "Music practice": ("Worship & Music", "daily"),
    "Plan tomorrow": ("Discipline & Planning", "daily"),
    "Plan the week": ("Discipline & Planning", "weekly"),
    "Task tracking": ("Discipline & Planning", "weekdays"),
    "Community prayer": ("Spiritual Life", "weekly"),
    "Prayer and fasting": ("Spiritual Life", "weekly"),
}

LINK_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "do", "for", "from",
    "get", "go", "have", "how", "i", "if", "in", "is", "it", "me", "my",
    "of", "on", "or", "so", "step", "that", "the", "this", "to", "up",
    "what", "who", "with", "you", "your",
}

CATEGORY_PRIORITY_RULES = [
    (re.compile(r"\b(marriage|courtship|spouse|dating|relationship|lara|kasope)\b", re.I), "Relationship & Marriage"),
    (re.compile(r"\b(worship team|piano|music production|instrumentals?|songwriting|podcast|chord|lyrics|waveform|vst|vocal|voice training)\b", re.I), "Worship & Music"),
    (re.compile(r"\b(hebrew|vocabulary|grammar|reading|pronoun test|lord'?s prayer)\b", re.I), "Hebrew & Language"),
    (re.compile(r"\b(ai|ml|aws|linkedin|cto|internship|job|museai|evaluation ai|prototype|frontend|back end|backend|architecture|workflow|testing|bugs|python|positions?)\b", re.I), "Career & AI"),
    (re.compile(r"\b(thesis|assignment|paper|archive|ofek|arieh|maya|alon|kobi|research|israeli studies|seminar|graduate program|proposal|presentation)\b", re.I), "Academics & Research"),
    (re.compile(r"\b(workout|physique|stretches|fitness)\b", re.I), "Health & Fitness"),
    (re.compile(r"\b(plan for tomorrow|plan for the week|discipline|accountability|tracking|clock in)\b", re.I), "Discipline & Planning"),
    (re.compile(r"\b(god|prayer|pray|bible|worship|sermon|church|fasting|spiritual|scriptures|time with god|holy spirit|tongues)\b", re.I), "Spiritual Life"),
]


@dataclass
class ParsedYearlyGoal:
    title: str
    description: str
    category_name: str
    target_date: str | None = None
    source_notes: list[str] = field(default_factory=list)


@dataclass
class ParsedMonthlyGoal:
    title: str
    description: str
    year: int
    month: int
    category_name: str
    linked_yearly_title: str | None
    is_main: bool
    progress: int
    source_week_labels: list[str] = field(default_factory=list)


@dataclass
class ParsedWeeklyGoal:
    title: str
    description: str
    year: int
    month: int
    week_number: int
    category_name: str
    is_main: bool
    progress: int
    status: str
    linked_yearly_title: str | None
    week_label: str
    source_type: str


@dataclass
class ParsedHabit:
    name: str
    category_name: str
    frequency: str
    evidence: int
    notes: list[str] = field(default_factory=list)


@dataclass
class ParsedHabitLog:
    habit_name: str
    log_date: str
    completed: bool
    note: str


@dataclass
class ParsedDailyPriority:
    title: str
    description: str
    plan_date: str
    category_name: str
    is_main: bool
    completed: bool
    linked_week_label: str | None
    linked_week_title: str | None
    source_section: str


@dataclass
class ImportPreview:
    year: int
    yearly_goals: list[ParsedYearlyGoal]
    monthly_goals: list[ParsedMonthlyGoal]
    weekly_goals: list[ParsedWeeklyGoal]
    daily_priorities: list[ParsedDailyPriority]
    habits: list[ParsedHabit]
    habit_logs: list[ParsedHabitLog]
    ambiguous_items: list[str]


@dataclass
class BulletNode:
    indent: int
    text: str
    checked: bool | None
    children: list["BulletNode"] = field(default_factory=list)


def read_input(path: str | None) -> str:
    if path:
        return Path(path).read_text(encoding="utf-8")
    return sys.stdin.read()


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def strip_trailing_counter(text: str) -> tuple[str, str | None]:
    match = re.match(r"^(.*?)(?:\s+\(([^)]{1,40})\))?$", text.strip())
    if not match:
        return text.strip(), None
    title = match.group(1).strip()
    counter = match.group(2).strip() if match.group(2) else None
    return title, counter


def month_abbr_to_int(value: str) -> int:
    return MONTH_ABBR[value.strip().upper()]


def infer_year(text: str) -> int:
    match = re.search(r"Goals\s+(\d{4})", text)
    if match:
        return int(match.group(1))
    match = re.search(r"\b(20\d{2})\b", text)
    if match:
        return int(match.group(1))
    return date.today().year


def flatten_children(nodes: Iterable[BulletNode]) -> list[str]:
    items: list[str] = []
    for node in nodes:
        title, counter = strip_trailing_counter(node.text)
        if counter:
            items.append(f"{title} ({counter})")
        else:
            items.append(title)
        items.extend(flatten_children(node.children))
    return items


def parse_bullet_tree(lines: list[str]) -> list[BulletNode]:
    nodes: list[BulletNode] = []
    stack: list[BulletNode] = []

    for raw in lines:
        if not raw.strip():
            continue
        checkbox = re.match(r"^(?P<indent>\s*)-\s*\[(?P<mark>[ xX])\]\s*(?P<text>.+)$", raw)
        plain = re.match(r"^(?P<indent>\s*)-\s+(?P<text>.+)$", raw)
        if checkbox:
            indent = len(checkbox.group("indent").replace("\t", "    "))
            node = BulletNode(
                indent=indent,
                text=checkbox.group("text").strip(),
                checked=checkbox.group("mark").lower() == "x",
            )
        elif plain:
            indent = len(plain.group("indent").replace("\t", "    "))
            node = BulletNode(indent=indent, text=plain.group("text").strip(), checked=None)
        else:
            continue

        while stack and stack[-1].indent >= node.indent:
            stack.pop()
        if stack:
            stack[-1].children.append(node)
        else:
            nodes.append(node)
        stack.append(node)

    return nodes


def completion_for_node(node: BulletNode) -> int:
    if node.children:
        leaf_values = [completion_for_node(child) for child in node.children]
        if not leaf_values:
            return 100 if node.checked else 0
        return round(sum(leaf_values) / len(leaf_values))
    if node.checked is None:
        return 0
    return 100 if node.checked else 0


def infer_category_name(text: str) -> str:
    normalized = text.strip()
    lowered = normalized.lower()
    if "relationship with god" in lowered or "closer relationship with god" in lowered:
        return "Spiritual Life"
    for pattern, category_name in CATEGORY_PRIORITY_RULES:
        if pattern.search(normalized):
            return category_name

    blob = lowered
    scored: list[tuple[int, str]] = []
    for category in CATEGORY_DEFS:
        score = sum(1 for keyword in category["keywords"] if keyword in blob)
        scored.append((score, category["name"]))
    scored.sort(reverse=True)
    return scored[0][1] if scored and scored[0][0] > 0 else "Admin & Life"


def category_meta(name: str) -> dict:
    for category in CATEGORY_DEFS:
        if category["name"] == name:
            return category
    return next(category for category in CATEGORY_DEFS if category["name"] == "Admin & Life")


def extract_yearly_goals(text: str, year: int) -> list[ParsedYearlyGoal]:
    if "Weekly Plan" not in text:
        return []
    yearly_blob = text.split("Weekly Plan", 1)[0]
    lines = yearly_blob.splitlines()
    current_title: str | None = None
    current_notes: list[str] = []
    goals: list[ParsedYearlyGoal] = []

    for raw in lines:
        if not raw.strip() or raw.strip().startswith("Goals "):
            continue
        star = re.match(r"^(?P<indent>\s*)\*\s+(?P<text>.+)$", raw)
        if not star:
            continue
        indent = len(star.group("indent").replace("\t", "    "))
        text_value = normalize_whitespace(star.group("text"))
        if indent <= 4:
            if current_title:
                goals.append(build_yearly_goal(current_title, current_notes, year))
            current_title = text_value
            current_notes = []
        else:
            current_notes.append(text_value)

    if current_title:
        goals.append(build_yearly_goal(current_title, current_notes, year))
    return goals


def build_yearly_goal(raw_title: str, notes: list[str], year: int) -> ParsedYearlyGoal:
    title = raw_title.strip()
    long_note = None
    paren = re.search(r"\(([^)]{20,})\)", title)
    if paren:
        long_note = paren.group(1).strip()
        title = normalize_whitespace(title.replace(paren.group(0), ""))
    category_name = infer_category_name(" ".join([title, *notes]))
    description_parts = [*notes]
    if long_note:
        description_parts.insert(0, long_note)
    description = "; ".join(description_parts) if description_parts else f"Imported 2026 goal for {title.lower()}."
    return ParsedYearlyGoal(
        title=title,
        description=description,
        category_name=category_name,
        # These are year-end outcomes, so default them to the last day of the year.
        target_date=date(year, 12, 31).isoformat(),
        source_notes=notes,
    )


@dataclass
class WeeklySection:
    label: str
    year: int
    start_date: date
    end_date: date
    lines: list[str]


def split_weekly_sections(text: str, year: int) -> list[WeeklySection]:
    sections: list[WeeklySection] = []
    current_label: str | None = None
    current_lines: list[str] = []
    current_start: date | None = None
    current_end: date | None = None

    week_header = re.compile(
        r"^Weekly\s+(?P<start_month>[A-Z]{3})\s+(?P<start_day>\d{1,2})\s*-\s*(?:(?P<end_month>[A-Z]{3})\s+)?(?P<end_day>\d{1,2})$"
    )

    for raw in text.splitlines():
        stripped = raw.strip()
        match = week_header.match(stripped)
        if match:
            if current_label and current_start and current_end:
                sections.append(
                    WeeklySection(
                        label=current_label,
                        year=year,
                        start_date=current_start,
                        end_date=current_end,
                        lines=current_lines,
                    )
                )
            start_month = month_abbr_to_int(match.group("start_month"))
            end_month = month_abbr_to_int(match.group("end_month") or match.group("start_month"))
            start_day = int(match.group("start_day"))
            end_day = int(match.group("end_day"))
            current_label = stripped
            current_start = date(year, start_month, start_day)
            current_end = date(year, end_month, end_day)
            current_lines = []
            continue
        if current_label:
            current_lines.append(raw.rstrip("\n"))

    if current_label and current_start and current_end:
        sections.append(
            WeeklySection(
                label=current_label,
                year=year,
                start_date=current_start,
                end_date=current_end,
                lines=current_lines,
            )
        )
    return sections


def looks_like_habit(text: str) -> bool:
    blob = text.lower()
    habit_tokens = [
        "every day", "wake up", "workout", "study the bible", "bible study",
        "worship", "pray", "catch up with lara", "finish 1 plan with lara",
        "hebrew", "plan for tomorrow", "plan for the week", "practise playing",
        "practice playing", "clock in", "watch a hebrew conversion video everyday",
        "produce basic instrumentals", "finish at least", "work on a guitar instrumentals",
    ]
    return any(token in blob for token in habit_tokens)


def canonical_habit_name(text: str) -> tuple[str, str]:
    blob = text.lower()
    for canonical_name, (category_name, _) in CANONICAL_HABIT_META.items():
        if blob == canonical_name.lower():
            return canonical_name, category_name
    if any(token in blob for token in ["bible study", "study the bible", "worship pray", "worship, pray", "pray and have bible study"]):
        return "Worship, prayer, and Bible study", "Spiritual Life"
    if "workout" in blob:
        return "Workout", "Health & Fitness"
    if "lara" in blob:
        return "Lara follow-up", "Relationship & Marriage"
    if "hebrew" in blob:
        return "Hebrew study", "Hebrew & Language"
    if any(token in blob for token in ["piano", "instrumentals", "music production", "guitar instrumentals", "both hands fluently", "worship team"]):
        return "Music practice", "Worship & Music"
    if "plan for tomorrow" in blob:
        return "Plan tomorrow", "Discipline & Planning"
    if "plan for the week" in blob:
        return "Plan the week", "Discipline & Planning"
    if "clock in" in blob or "tracking" in blob:
        return "Task tracking", "Discipline & Planning"
    if "community prayer" in blob:
        return "Community prayer", "Spiritual Life"
    if "praying and fasting" in blob or "prayer and fasting" in blob:
        return "Prayer and fasting", "Spiritual Life"
    return strip_trailing_counter(text)[0], infer_category_name(text)


def should_skip_item(title: str) -> bool:
    normalized = normalize_whitespace(title).lower().rstrip(":")
    return normalized in {
        "",
        "major goal",
        "supporting",
        "habits/foundations",
        "habits foundations",
        "reminders",
    }


def matching_dates_for_weekday(section: WeeklySection, weekday_name: str) -> list[date]:
    weekday = WEEKDAY_INDEX[weekday_name.lower()]
    # Prefer dates that fall inside the declared weekly range. This keeps
    # "Day 2 - Monday" in `Weekly APR 19 - APR 25` anchored to April 20 rather
    # than incorrectly snapping to the prior Monday. We only consider the
    # preceding week as a fallback for older note formats that sometimes mixed
    # weekday labels into a Sunday-start range.
    in_range_matches: list[date] = []
    cursor = section.start_date
    while cursor <= section.end_date:
        if cursor.weekday() == weekday:
            in_range_matches.append(cursor)
        cursor += timedelta(days=1)
    if in_range_matches:
        return in_range_matches

    search_start = section.start_date - timedelta(days=6)
    fallback_matches: list[date] = []
    cursor = search_start
    while cursor < section.start_date:
        if cursor.weekday() == weekday:
            fallback_matches.append(cursor)
        cursor += timedelta(days=1)
    return fallback_matches


def resolve_day_date(section: WeeklySection, weekday_name: str, used_dates: set[date]) -> date | None:
    for candidate in matching_dates_for_weekday(section, weekday_name):
        if candidate not in used_dates:
            return candidate
    return None


def parse_structured_week(
    section: WeeklySection,
    yearly_goals: list[ParsedYearlyGoal],
    habit_counter: Counter[str],
    habit_notes: dict[str, list[str]],
    habit_logs: list[ParsedHabitLog],
    ambiguous_items: list[str],
    week_starts_on: str = "monday",
) -> tuple[list[ParsedWeeklyGoal], list[ParsedDailyPriority]]:
    week_sections: dict[str, list[str]] = defaultdict(list)
    day_sections: dict[str, dict[str, list[str]]] = {}
    current_scope = "week"
    current_section = "supporting"
    current_day = None

    for raw in section.lines:
        stripped = raw.strip()
        if not stripped:
            continue
        day_match = re.match(r"^Day\s+\d+\s*-\s*(?P<weekday>[A-Za-z]+)", stripped)
        if day_match:
            current_day = day_match.group("weekday").capitalize()
            current_scope = "day"
            current_section = "general"
            day_sections.setdefault(current_day, defaultdict(list))
            continue
        if stripped in {"Major Goal", "Supporting", "Habits/Foundations", "Reminders"}:
            current_section = stripped.lower().replace("/", "_").replace(" ", "_")
            continue

        if current_scope == "week":
            week_sections[current_section].append(raw)
        elif current_day:
            day_sections[current_day][current_section].append(raw)

    weekly_goals: list[ParsedWeeklyGoal] = []
    daily_priorities: list[ParsedDailyPriority] = []

    major_nodes = parse_bullet_tree(week_sections.get("major_goal", []))
    supporting_nodes = parse_bullet_tree(week_sections.get("supporting", []))
    habit_nodes = parse_bullet_tree(week_sections.get("habits_foundations", []))

    section_week_number = week_number_for(section.start_date, week_starts_on)
    monthly_year = section.start_date.year
    monthly_month = section.start_date.month

    all_goal_nodes = [("major", node) for node in major_nodes] + [("support", node) for node in supporting_nodes]
    for idx, (group, node) in enumerate(all_goal_nodes):
        title, counter = strip_trailing_counter(node.text)
        if should_skip_item(title):
            continue
        description_bits = flatten_children(node.children)
        if counter:
            description_bits.insert(0, f"Progress note: {counter}.")
        category_name = infer_category_name(" ".join([title, *description_bits]))
        linked_yearly = match_yearly_goal(category_name, title, yearly_goals)
        progress = completion_for_node(node)
        weekly_goals.append(
            ParsedWeeklyGoal(
                title=title,
                description="; ".join(description_bits) if description_bits else f"Imported from {section.label}.",
                year=monthly_year,
                month=monthly_month,
                week_number=section_week_number,
                category_name=category_name,
                is_main=(group == "major" and idx == 0),
                progress=progress,
                status="completed" if progress >= 100 else "active",
                linked_yearly_title=linked_yearly.title if linked_yearly else None,
                week_label=section.label,
                source_type="structured-week",
            )
        )

    for node in habit_nodes:
        title = strip_trailing_counter(node.text)[0]
        if should_skip_item(title):
            continue
        canonical_name, category_name = canonical_habit_name(title)
        habit_counter[canonical_name] += 1
        habit_notes[canonical_name].append(f"{section.label}: {title}")

    used_dates: set[date] = set()
    week_goal_lookup = weekly_goals.copy()
    for weekday_name, grouped_lines in day_sections.items():
        day_date = resolve_day_date(section, weekday_name, used_dates)
        if not day_date:
            ambiguous_items.append(f"Could not resolve date for {weekday_name} in {section.label}.")
            continue
        used_dates.add(day_date)

        for bucket_name, lines in grouped_lines.items():
            nodes = parse_bullet_tree(lines)
            for node in nodes:
                title, counter = strip_trailing_counter(node.text)
                if should_skip_item(title):
                    continue
                description_bits = flatten_children(node.children)
                if counter:
                    description_bits.insert(0, f"Progress note: {counter}.")
                category_name = infer_category_name(" ".join([title, *description_bits]))

                if bucket_name == "habits_foundations" or (bucket_name == "general" and looks_like_habit(title)):
                    canonical_name, habit_category_name = canonical_habit_name(title)
                    habit_counter[canonical_name] += 1
                    habit_notes[canonical_name].append(f"{day_date.isoformat()}: {title}")
                    if node.checked is not None:
                        habit_logs.append(
                            ParsedHabitLog(
                                habit_name=canonical_name,
                                log_date=day_date.isoformat(),
                                completed=bool(node.checked),
                                note=f"{section.label} / {weekday_name}",
                            )
                        )
                    continue

                linked_week = match_weekly_goal(category_name, title, week_goal_lookup)
                daily_priorities.append(
                    ParsedDailyPriority(
                        title=title,
                        description="; ".join(description_bits) if description_bits else f"Imported from {section.label} / {weekday_name}.",
                        plan_date=day_date.isoformat(),
                        category_name=category_name,
                        is_main=bucket_name == "major_goal",
                        completed=bool(node.checked) if node.checked is not None else False,
                        linked_week_label=section.label,
                        linked_week_title=linked_week.title if linked_week else None,
                        source_section=bucket_name,
                    )
                )

    return weekly_goals, daily_priorities


def parse_unstructured_week(
    section: WeeklySection,
    yearly_goals: list[ParsedYearlyGoal],
    habit_counter: Counter[str],
    habit_notes: dict[str, list[str]],
    week_starts_on: str = "monday",
) -> list[ParsedWeeklyGoal]:
    nodes = parse_bullet_tree(section.lines)
    weekly_goals: list[ParsedWeeklyGoal] = []
    section_week_number = week_number_for(section.start_date, week_starts_on)

    for node in nodes:
        title, counter = strip_trailing_counter(node.text)
        child_lines = flatten_children(node.children)
        if counter:
            child_lines.insert(0, f"Progress note: {counter}.")

        if looks_like_habit(title):
            canonical_name, category_name = canonical_habit_name(title)
            habit_counter[canonical_name] += 1
            note = title if not child_lines else f"{title} -> {'; '.join(child_lines[:4])}"
            habit_notes[canonical_name].append(f"{section.label}: {note}")
            continue

        category_name = infer_category_name(" ".join([title, *child_lines]))
        linked_yearly = match_yearly_goal(category_name, title, yearly_goals)
        progress = completion_for_node(node)
        weekly_goals.append(
            ParsedWeeklyGoal(
                title=title,
                description="; ".join(child_lines) if child_lines else f"Imported from {section.label}.",
                year=section.start_date.year,
                month=section.start_date.month,
                week_number=section_week_number,
                category_name=category_name,
                is_main=False,
                progress=progress,
                status="completed" if progress >= 100 else "active",
                linked_yearly_title=linked_yearly.title if linked_yearly else None,
                week_label=section.label,
                source_type="unstructured-week",
            )
        )

    if weekly_goals:
        best_index = 0
        best_score = -1
        for idx, goal in enumerate(weekly_goals):
            score = 0
            blob = f"{goal.title} {goal.description}".lower()
            if any(token in blob for token in ["build", "prototype", "finish", "prepare", "museai", "evaluation ai", "job", "thesis"]):
                score += 3
            if goal.category_name in {"Career & AI", "Academics & Research"}:
                score += 2
            if goal.progress < 100:
                score += 1
            if score > best_score:
                best_index = idx
                best_score = score
        weekly_goals[best_index].is_main = True

    return weekly_goals


def match_yearly_goal(category_name: str, title: str, yearly_goals: list[ParsedYearlyGoal]) -> ParsedYearlyGoal | None:
    same_category = [goal for goal in yearly_goals if goal.category_name == category_name]
    if not same_category:
        return None
    title_tokens = {
        token for token in re.findall(r"[a-z0-9]+", title.lower())
        if len(token) > 2 and token not in LINK_STOPWORDS
    }
    ranked: list[tuple[int, ParsedYearlyGoal]] = []
    for goal in same_category:
        goal_tokens = {
            token for token in re.findall(r"[a-z0-9]+", f"{goal.title} {goal.description}".lower())
            if len(token) > 2 and token not in LINK_STOPWORDS
        }
        overlap = len(title_tokens & goal_tokens)
        ranked.append((overlap, goal))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return ranked[0][1]


def match_weekly_goal(category_name: str, title: str, weekly_goals: list[ParsedWeeklyGoal]) -> ParsedWeeklyGoal | None:
    same_category = [goal for goal in weekly_goals if goal.category_name == category_name]
    if same_category:
        mains = [goal for goal in same_category if goal.is_main]
        return mains[0] if mains else same_category[0]
    return weekly_goals[0] if weekly_goals else None


def build_monthly_goals(
    weekly_goals: list[ParsedWeeklyGoal],
    yearly_goals: list[ParsedYearlyGoal],
) -> list[ParsedMonthlyGoal]:
    grouped: dict[tuple[int, int, str], list[ParsedWeeklyGoal]] = defaultdict(list)
    for goal in weekly_goals:
        grouped[(goal.year, goal.month, goal.category_name)].append(goal)

    month_main_scores: dict[tuple[int, int], tuple[str, int]] = {}
    for (year, month, category_name), goals in grouped.items():
        score = sum(2 if goal.is_main else 1 for goal in goals)
        current = month_main_scores.get((year, month))
        if not current or score > current[1]:
            month_main_scores[(year, month)] = (category_name, score)

    monthly_goals: list[ParsedMonthlyGoal] = []
    for (year, month, category_name), goals in sorted(grouped.items()):
        linked_yearly = match_yearly_goal(category_name, " ".join(goal.title for goal in goals[:3]), yearly_goals)
        top_titles = [goal.title for goal in goals[:5]]
        description = f"Imported monthly focus synthesized from {len(goals)} weekly goal(s): " + "; ".join(top_titles)
        progress = round(sum(goal.progress for goal in goals) / len(goals)) if goals else 0
        main_category = month_main_scores[(year, month)][0]
        monthly_goals.append(
            ParsedMonthlyGoal(
                title=MONTHLY_TITLES.get(category_name, f"Imported {category_name} focus"),
                description=description,
                year=year,
                month=month,
                category_name=category_name,
                linked_yearly_title=linked_yearly.title if linked_yearly else None,
                is_main=category_name == main_category,
                progress=progress,
                source_week_labels=sorted({goal.week_label for goal in goals}),
            )
        )
    return monthly_goals


def build_habits(habit_counter: Counter[str], habit_notes: dict[str, list[str]]) -> list[ParsedHabit]:
    habits: list[ParsedHabit] = []
    for name, evidence in habit_counter.most_common():
        category_name, frequency = CANONICAL_HABIT_META.get(name, canonical_habit_name(name)[1:2] + ("weekdays",))
        habits.append(
            ParsedHabit(
                name=name,
                category_name=category_name,
                frequency=frequency,
                evidence=evidence,
                notes=habit_notes.get(name, [])[:12],
            )
        )
    return habits


def parse_history(text: str, week_starts_on: str = "monday") -> ImportPreview:
    resolved_week_starts_on = resolve_week_starts_on(week_starts_on)
    year = infer_year(text)
    yearly_goals = extract_yearly_goals(text, year)
    weekly_sections = split_weekly_sections(text, year)
    all_weekly_goals: list[ParsedWeeklyGoal] = []
    all_daily_priorities: list[ParsedDailyPriority] = []
    ambiguous_items: list[str] = []
    habit_counter: Counter[str] = Counter()
    habit_notes: dict[str, list[str]] = defaultdict(list)
    habit_logs: list[ParsedHabitLog] = []

    for section in weekly_sections:
        if not any(line.strip() for line in section.lines):
            continue
        structured = any(line.strip() in {"Major Goal", "Supporting", "Habits/Foundations"} for line in section.lines)
        if structured:
            weekly_goals, daily_priorities = parse_structured_week(
                section,
                yearly_goals,
                habit_counter,
                habit_notes,
                habit_logs,
                ambiguous_items,
                resolved_week_starts_on,
            )
            all_weekly_goals.extend(weekly_goals)
            all_daily_priorities.extend(daily_priorities)
        else:
            all_weekly_goals.extend(
                parse_unstructured_week(
                    section,
                    yearly_goals,
                    habit_counter,
                    habit_notes,
                    resolved_week_starts_on,
                )
            )

    monthly_goals = build_monthly_goals(all_weekly_goals, yearly_goals)
    habits = build_habits(habit_counter, habit_notes)

    return ImportPreview(
        year=year,
        yearly_goals=yearly_goals,
        monthly_goals=monthly_goals,
        weekly_goals=all_weekly_goals,
        daily_priorities=all_daily_priorities,
        habits=habits,
        habit_logs=habit_logs,
        ambiguous_items=ambiguous_items,
    )


def preview_as_dict(preview: ImportPreview) -> dict:
    return {
        "year": preview.year,
        "counts": {
            "yearly_goals": len(preview.yearly_goals),
            "monthly_goals": len(preview.monthly_goals),
            "weekly_goals": len(preview.weekly_goals),
            "daily_priorities": len(preview.daily_priorities),
            "habits": len(preview.habits),
            "habit_logs": len(preview.habit_logs),
            "ambiguous_items": len(preview.ambiguous_items),
        },
        "yearly_goals": [asdict(item) for item in preview.yearly_goals],
        "monthly_goals": [asdict(item) for item in preview.monthly_goals],
        "weekly_goals": [asdict(item) for item in preview.weekly_goals],
        "daily_priorities": [asdict(item) for item in preview.daily_priorities],
        "habits": [asdict(item) for item in preview.habits],
        "habit_logs": [asdict(item) for item in preview.habit_logs],
        "ambiguous_items": preview.ambiguous_items,
    }


def print_text_preview(preview: ImportPreview) -> None:
    print(f"Import preview for {preview.year}")
    print(
        f"- Yearly goals: {len(preview.yearly_goals)} | Monthly goals: {len(preview.monthly_goals)} | "
        f"Weekly goals: {len(preview.weekly_goals)} | Daily priorities: {len(preview.daily_priorities)} | "
        f"Habits: {len(preview.habits)}"
    )
    print()

    print("Yearly goals:")
    for goal in preview.yearly_goals:
        print(f"- [{goal.category_name}] {goal.title}")
        if goal.description:
            print(f"  {goal.description}")
    print()

    print("Monthly goals:")
    for goal in preview.monthly_goals:
        label = date(goal.year, goal.month, 1).strftime("%b %Y")
        main = "main" if goal.is_main else "support"
        print(f"- {label} | [{goal.category_name}] {goal.title} ({main}, {goal.progress}%)")
        print(f"  linked yearly: {goal.linked_yearly_title or 'none'}")
    print()

    print("Weekly goals (first 20):")
    for goal in preview.weekly_goals[:20]:
        print(
            f"- W{goal.week_number} {goal.week_label} | [{goal.category_name}] {goal.title} "
            f"({'main' if goal.is_main else 'support'}, {goal.progress}%)"
        )
    if len(preview.weekly_goals) > 20:
        print(f"  ... and {len(preview.weekly_goals) - 20} more")
    print()

    print("Habits:")
    for habit in preview.habits:
        print(f"- [{habit.category_name}] {habit.name} ({habit.frequency}, evidence={habit.evidence})")
    print()

    print("Daily priorities (first 20):")
    for item in preview.daily_priorities[:20]:
        print(
            f"- {item.plan_date} | [{'MAIN' if item.is_main else 'SUPPORT'}] {item.title} "
            f"[{item.category_name}] completed={item.completed}"
        )
    if len(preview.daily_priorities) > 20:
        print(f"  ... and {len(preview.daily_priorities) - 20} more")
    print()

    if preview.ambiguous_items:
        print("Ambiguous items:")
        for item in preview.ambiguous_items:
            print(f"- {item}")
    else:
        print("Ambiguous items: none")


def find_auth_user_id_by_email(email: str) -> str | None:
    db = get_supabase()
    page = 1
    while True:
        result = db.auth.admin.list_users(page=page, per_page=200)
        users = getattr(result, "users", None) or getattr(result, "data", {}).get("users", [])
        if not users:
            return None
        for user in users:
            user_email = getattr(user, "email", None) or user.get("email")
            if user_email and user_email.lower() == email.lower():
                return getattr(user, "id", None) or user.get("id")
        if len(users) < 200:
            return None
        page += 1


def ensure_target_session(
    auth_user_id: str,
    timezone: str,
    week_starts_on: str | None = None,
) -> dict:
    db = get_supabase()
    session = sessions_db.get_session_by_auth_user_id(db, auth_user_id)
    if session:
        return session
    return sessions_db.create_session(
        db,
        device_hint="history-import",
        timezone=timezone,
        auth_user_id=auth_user_id,
        week_starts_on=week_starts_on,
    )


def upsert_category_map(session_id: str, preview: ImportPreview) -> dict[str, dict]:
    db = get_supabase()
    existing = {row["name"]: row for row in categories_db.list_categories(db, session_id)}
    for idx, name in enumerate({goal.category_name for goal in preview.yearly_goals + preview.monthly_goals + preview.weekly_goals} | {habit.category_name for habit in preview.habits} | {item.category_name for item in preview.daily_priorities}):
        if name in existing:
            continue
        meta = category_meta(name)
        existing[name] = categories_db.create_category(
            db,
            session_id,
            {
                "name": name,
                "icon": meta["icon"],
                "color": meta["color"],
                "sort_order": idx,
            },
        )
    return existing


def apply_preview(
    preview: ImportPreview,
    auth_user_id: str,
    timezone: str,
    replace_existing: bool = False,
    week_starts_on: str | None = None,
) -> dict:
    db = get_supabase()
    resolved_week_starts_on = resolve_week_starts_on(week_starts_on, timezone)
    session = ensure_target_session(auth_user_id, timezone, resolved_week_starts_on)
    session_id = session["id"]

    if replace_existing:
        db.table("habit_logs").delete().eq("session_id", session_id).execute()
        db.table("daily_priorities").delete().eq("session_id", session_id).execute()
        db.table("daily_plans").delete().eq("session_id", session_id).execute()
        db.table("weekly_goals").delete().eq("session_id", session_id).execute()
        db.table("weekly_plans").delete().eq("session_id", session_id).execute()
        db.table("monthly_goals").delete().eq("session_id", session_id).execute()
        db.table("monthly_plans").delete().eq("session_id", session_id).execute()
        db.table("yearly_goals").delete().eq("session_id", session_id).eq("year", preview.year).execute()
        db.table("foundational_habits").delete().eq("session_id", session_id).execute()
        db.table("categories").delete().eq("session_id", session_id).execute()

    categories = upsert_category_map(session_id, preview)

    yearly_id_by_title: dict[str, str] = {}
    # Update-in-place when we find matching titles so reruns stay idempotent and
    # can repair older imported rows instead of silently leaving stale values behind.
    existing_yearly = yearly_goals_db.list_yearly_goals(db, session_id, preview.year)
    existing_yearly_by_title = {row["title"]: row for row in existing_yearly}
    for goal in preview.yearly_goals:
        row = existing_yearly_by_title.get(goal.title)
        payload = {
            "category_id": categories[goal.category_name]["id"],
            "title": goal.title,
            "description": goal.description,
            "year": preview.year,
            "target_date": goal.target_date,
        }
        if not row:
            row = yearly_goals_db.create_yearly_goal(
                db,
                session_id,
                payload,
            )
        else:
            row = yearly_goals_db.update_yearly_goal(
                db,
                row["id"],
                session_id,
                {
                    **payload,
                    "status": row.get("status") or "active",
                    "progress": row.get("progress", 0),
                },
            )
        yearly_id_by_title[goal.title] = row["id"]

    monthly_id_by_key: dict[tuple[int, int, str], str] = {}
    existing_monthlies = {
        (row["year"], row["month"], row["title"]): row
        for row in plans_db.list_monthly_goals_for_year(db, session_id, preview.year)
    }
    for goal in preview.monthly_goals:
        plan = plans_db.upsert_monthly_plan(
            db,
            session_id,
            {
                "year": goal.year,
                "month": goal.month,
                "status": "draft",
                "days_in_month": 31,
                "days_remaining": 31,
            },
        )
        key = (goal.year, goal.month, goal.title)
        row = existing_monthlies.get(key)
        payload = {
            "session_id": session_id,
            "monthly_plan_id": plan["id"],
            "yearly_goal_id": yearly_id_by_title.get(goal.linked_yearly_title) if goal.linked_yearly_title else None,
            "category_id": categories[goal.category_name]["id"],
            "title": goal.title,
            "description": goal.description,
            "year": goal.year,
            "month": goal.month,
            "status": "completed" if goal.progress >= 100 else "active",
            "progress": goal.progress,
            "priority": "high" if goal.is_main else "medium",
            "is_main": goal.is_main,
            "target_date": None,
            "workload": None,
            "ai_suggested": False,
        }
        if not row:
            row = plans_db.create_monthly_goal(
                db,
                payload,
            )
        else:
            row = plans_db.update_monthly_goal(
                db,
                row["id"],
                session_id,
                payload,
            )
        monthly_id_by_key[(goal.year, goal.month, goal.category_name)] = row["id"]

    weekly_id_by_key: dict[tuple[int, int, str], str] = {}
    # Daily plans point to weekly_plans, while daily priorities point to weekly_goals.
    weekly_plan_id_by_key: dict[tuple[int, int, str], str] = {}
    existing_weeklies = {
        (row["year"], row["week_number"], row["title"]): row
        for row in plans_db.list_weekly_goals_for_year(db, session_id, preview.year)
    }
    for goal in preview.weekly_goals:
        week_start, week_end = get_week_boundaries(goal.year, goal.week_number, resolved_week_starts_on)
        plan = plans_db.upsert_weekly_plan(
            db,
            session_id,
            {
                "year": goal.year,
                "month": goal.month,
                "week_number": goal.week_number,
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "status": "draft",
                "days_remaining": 7,
            },
        )
        key = (goal.year, goal.week_number, goal.title)
        row = existing_weeklies.get(key)
        payload = {
            "session_id": session_id,
            "weekly_plan_id": plan["id"],
            "monthly_goal_id": monthly_id_by_key.get((goal.year, goal.month, goal.category_name)),
            "title": goal.title,
            "description": goal.description,
            "year": goal.year,
            "month": goal.month,
            "week_number": goal.week_number,
            "status": goal.status,
            "progress": goal.progress,
            "is_main": goal.is_main,
            "target_day": None,
            "goal_type": "tactical" if goal.is_main else "operational",
            "workload": None,
            "ai_suggested": False,
        }
        if not row:
            row = plans_db.create_weekly_goal(
                db,
                payload,
            )
        else:
            row = plans_db.update_weekly_goal(
                db,
                row["id"],
                session_id,
                payload,
            )
        weekly_id_by_key[(goal.year, goal.week_number, goal.title)] = row["id"]
        weekly_plan_id_by_key[(goal.year, goal.week_number, goal.title)] = plan["id"]

    existing_habits = {row["name"]: row for row in habits_db.list_habits(db, session_id, active_only=False)}
    habit_id_by_name: dict[str, str] = {}
    for habit in preview.habits:
        row = existing_habits.get(habit.name)
        payload = {
            "name": habit.name,
            "icon": category_meta(habit.category_name)["icon"],
            "frequency": habit.frequency,
            "category_id": categories[habit.category_name]["id"],
            "sort_order": 0,
            "active": True,
        }
        if not row:
            row = habits_db.create_habit(
                db,
                session_id,
                payload,
            )
        else:
            row = habits_db.update_habit(
                db,
                row["id"],
                session_id,
                payload,
            )
        habit_id_by_name[habit.name] = row["id"]

    existing_daily = defaultdict(dict)
    for item in preview.daily_priorities:
        existing_daily[item.plan_date] = {
            row["title"]: row
            for row in plans_db.list_daily_priorities(db, session_id, datetime.fromisoformat(item.plan_date).date())
        }

    for item in preview.daily_priorities:
        plan_date = datetime.fromisoformat(item.plan_date).date()
        week_key = None
        if item.linked_week_title:
            week_match = next(
                (
                    goal for goal in preview.weekly_goals
                    if goal.week_label == item.linked_week_label and goal.title == item.linked_week_title
                ),
                None,
            )
            if week_match:
                week_key = (week_match.year, week_match.week_number, week_match.title)
        plan = plans_db.upsert_daily_plan(
            db,
            session_id,
            {
                "weekly_plan_id": weekly_plan_id_by_key.get(week_key) if week_key else None,
                "date": item.plan_date,
                "status": "draft",
            },
        )
        payload = {
            "session_id": session_id,
            "daily_plan_id": plan["id"],
            "weekly_goal_id": weekly_id_by_key.get(week_key) if week_key else None,
            "title": item.title,
            "description": item.description,
            "date": item.plan_date,
            "status": "completed" if item.completed else "active",
            "completed": item.completed,
            "priority": "high" if item.is_main else "medium",
            "estimated_minutes": None,
            "is_main": item.is_main,
            "tag": item.category_name,
            "ai_suggested": False,
            "notes": f"Imported from {item.source_section} / {item.linked_week_label}",
        }
        existing_item = existing_daily[item.plan_date].get(item.title)
        if existing_item:
            plans_db.update_daily_priority(
                db,
                existing_item["id"],
                session_id,
                payload,
            )
        else:
            created = plans_db.create_daily_priority(db, payload)
            existing_daily[item.plan_date][item.title] = created

    for log in preview.habit_logs:
        habit_id = habit_id_by_name.get(log.habit_name)
        if not habit_id:
            continue
        habits_db.upsert_habit_log(
            db,
            habit_id=habit_id,
            session_id=session_id,
            log_date=datetime.fromisoformat(log.log_date).date(),
            completed=log.completed,
        )

    sessions_db.update_session(
        db,
        session["id"],
        {
            "onboarding_done": True,
            "onboarding_step": 4,
            "week_starts_on": resolved_week_starts_on,
        },
    )

    return {
        "session_id": session_id,
        "counts": preview_as_dict(preview)["counts"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Private preview/apply importer for historical notes.")
    parser.add_argument("--input", help="Path to raw notes file. If omitted, reads stdin.")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--output", help="Optional path to save preview JSON.")
    parser.add_argument("--apply", action="store_true", help="Apply the preview into a target account.")
    parser.add_argument("--email", help="Target auth email when applying.")
    parser.add_argument("--auth-user-id", help="Target auth user id when applying.")
    parser.add_argument("--timezone", default="Asia/Jerusalem", help="Timezone for session creation if needed.")
    parser.add_argument("--week-starts-on", choices=["sunday", "monday"], default="sunday", help="Planning week model to use while parsing/importing.")
    parser.add_argument("--replace-existing", action="store_true", help="Delete existing planning data before import.")
    args = parser.parse_args()

    raw = read_input(args.input)
    preview = parse_history(raw, week_starts_on=args.week_starts_on)

    if args.output:
        Path(args.output).write_text(json.dumps(preview_as_dict(preview), indent=2), encoding="utf-8")

    if args.format == "json":
        print(json.dumps(preview_as_dict(preview), indent=2))
    else:
        print_text_preview(preview)

    if not args.apply:
        return 0

    auth_user_id = args.auth_user_id
    if not auth_user_id and args.email:
        auth_user_id = find_auth_user_id_by_email(args.email)
    if not auth_user_id:
        print("\nApply mode requires --auth-user-id or a resolvable --email.", file=sys.stderr)
        return 2

    result = apply_preview(
        preview,
        auth_user_id=auth_user_id,
        timezone=args.timezone,
        replace_existing=args.replace_existing,
        week_starts_on=args.week_starts_on,
    )
    print("\nApplied import:")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
