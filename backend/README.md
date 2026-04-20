# Execution AI — Backend

Python + FastAPI backend for the Execution AI MVP.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.111 |
| Validation | Pydantic v2 |
| Database | Supabase (PostgreSQL) |
| AI | Google AI Studio / Gemini |
| Date logic | Python `calendar` + `dateutil` |
| Logging | structlog |

---

## Architecture

```
app/
├── main.py                    # FastAPI app, routes registration, CORS, error handlers
├── api/
│   ├── deps.py                # Dependency injection (Supabase client)
│   └── routes/
│       ├── sessions.py        # POST /session/start, GET/PATCH /session/{id}
│       ├── yearly_goals.py    # Yearly goals + categories CRUD
│       ├── plans.py           # Monthly/weekly/daily plan generate + approve
│       ├── execution.py       # Task/habit status updates, goal progress
│       ├── habits.py          # Habit CRUD
│       ├── dashboard.py       # GET /dashboard/{session_id}
│       ├── goals_hierarchy.py # GET /goals/{session_id} — full hierarchy
│       └── reports.py         # Report generate + list
├── core/
│   ├── config.py              # Settings from .env (pydantic-settings)
│   ├── logging.py             # structlog configuration
│   └── exceptions.py          # Typed HTTP exceptions
├── db/
│   ├── client.py              # Supabase singleton (service role)
│   ├── sessions.py            # Session repository
│   ├── categories.py          # Category repository
│   ├── yearly_goals.py        # Yearly goal repository
│   ├── plans.py               # Monthly/weekly/daily plan + goal repositories
│   ├── habits.py              # Habit + habit log repositories
│   └── reports.py             # Report snapshot + AI generation log
├── schemas/
│   ├── common.py              # Shared enums (GoalStatus, PriorityLevel, etc.)
│   ├── session.py             # Session request/response schemas
│   ├── goals.py               # All goal schemas + hierarchy response
│   ├── habits.py              # Habit schemas
│   ├── plans.py               # Plan generate/approve schemas
│   ├── dashboard.py           # Dashboard aggregate schema
│   └── reports.py             # Report schemas + AI output schemas
├── services/
│   ├── ai_service.py          # Google AI Studio / Gemini wrapper + generation functions
│   ├── planning_service.py    # Monthly/weekly/daily plan orchestration
│   ├── execution_service.py   # Task/habit completion tracking
│   ├── dashboard_service.py   # Dashboard data aggregation
│   └── report_service.py      # Report generation (metrics + AI narrative)
└── utils/
    ├── date_utils.py          # All date/time math (TemporalContext)
    ├── planning_logic.py      # Workload budgets + planning payload builder
    └── metrics.py             # Completion rates, streaks, aggregations
```

---

## Quick Start

### 1. Set up environment

```bash
cd backend
cp .env.example .env
# Fill in your Supabase and Google AI Studio credentials
```

### 2. Create a virtual environment

```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 3. Run the database migration

In your Supabase dashboard → SQL Editor, run:

```
migrations/001_initial_schema.sql
migrations/002_add_frontend_fields.sql
migrations/003_weekly_goal_workload.sql
migrations/004_report_snapshot_unique_indexes.sql
migrations/005_sessions_auth_user_link.sql
```

### 4. Start the server

```bash
python run.py
# or
uvicorn app.main:app --reload
```

API docs available at: http://localhost:8000/docs

---

## API Overview

### Session Management
```
POST   /session/start              # Create or recover a workspace session
GET    /session/{id}               # Get session info
PATCH  /session/{id}               # Update onboarding step, timezone, auth user link
```

### Onboarding / Planning Flow
```
# Stage 1 — Yearly Goals
POST   /yearly-goals/{session_id}/categories
GET    /yearly-goals/{session_id}/categories
POST   /yearly-goals/{session_id}
GET    /yearly-goals/{session_id}
PATCH  /yearly-goals/{session_id}/{goal_id}
DELETE /yearly-goals/{session_id}/{goal_id}

# Stage 2 — Monthly Plan
POST   /monthly-plan/generate           # AI generates monthly plan draft
POST   /monthly-plan/save               # User approves draft → creates goals
GET    /monthly-plan/{session_id}

# Stage 3 — Weekly Plan
POST   /weekly-plan/generate            # AI generates weekly plan draft
POST   /weekly-plan/save                # User approves → creates goals
GET    /weekly-plan/{session_id}

# Stage 4 — Daily Plan
POST   /daily-plan/generate             # AI generates daily plan draft
POST   /daily-plan/save                 # User approves → creates priorities
GET    /daily-plan/{session_id}
```

### Execution Tracking
```
PATCH  /tasks/{task_id}/status          # Mark task complete/incomplete
PATCH  /tasks/{task_id}                 # Edit task fields
POST   /tasks                           # Add manual task
PATCH  /habits/{habit_id}/status        # Mark habit complete/incomplete
PATCH  /goals/{type}/{goal_id}/progress # Update goal progress 0-100
```

### Dashboard & Hierarchy
```
GET    /dashboard/{session_id}          # Full current-day dashboard
GET    /goals/{session_id}              # Full goal hierarchy (yearly→daily)
```

### Habits
```
GET    /habits/{session_id}
POST   /habits/{session_id}
PATCH  /habits/{session_id}/{habit_id}
DELETE /habits/{session_id}/{habit_id}
```

### Reports
```
GET    /reports/{session_id}            # List all reports
POST   /reports/daily/generate          # Generate daily report (after cutoff hour)
POST   /reports/weekly/generate         # Generate weekly report
POST   /reports/monthly/generate        # Generate monthly report
POST   /reports/yearly/generate         # Generate yearly report
```

---

## Key Design Decisions

### Time-Aware Planning
The `TemporalContext` dataclass captures all time-related facts at request time:
- Days remaining in month / week
- Whether we're late in the period
- Week boundaries (ISO standard: Monday = week start)

This is computed once per request and passed to the planning layer and AI prompts.

### Workload Budgets (No AI Math)
The `WorkloadBudget` system determines how many goals/tasks are realistic based on
time remaining — **before** any AI call. The AI receives hard limits it must respect.

| Days Remaining | Monthly Budget |
|---|---|
| ≥ 21 days | 3 main + 5 secondary goals |
| 14-20 days | 2 main + 4 secondary goals |
| 7-13 days | 2 main + 3 secondary (compressed) |
| < 7 days | 1 main + 2 secondary (minimal) |

### Draft → Approve Pattern
All AI-generated plans follow a two-step pattern:
1. `POST /*/generate` → AI draft saved, not committed
2. `POST /*/save` → User reviews, optionally modifies, approves

This keeps AI output auditable and gives users control.

### AI Layer Contract
The AI service receives a structured `planning_payload` dict — never raw database records.
It returns validated Pydantic models. The AI cannot affect database state directly.

### Report Generation
Reports are always computed first in Python (completion rates, streaks, aggregations),
then a compact metrics summary is sent to Gemini for narrative generation only.
AI never sees raw task logs — only aggregated numbers.

---

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (used server-side) |
| `GOOGLE_AI_API_KEY` | Google AI Studio API key for Gemini |
| `GEMINI_MODEL` | Gemini model id |
| `GEMINI_REQUEST_TIMEOUT_MS` | HTTP timeout for Gemini calls in ms |
| `GEMINI_MAX_OUTPUT_TOKENS` | Upper bound for Gemini output tokens |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins for production |
| `REPORT_CUTOFF_HOUR` | Hour (UTC) after which daily reports can generate (default: `18`) |
| `APP_ENV` | `development` \| `production` |

### Production Notes

- Set `CORS_ORIGINS` to the exact frontend origins you deploy from, comma-separated.
- Rotate `SUPABASE_SERVICE_ROLE_KEY` and `GOOGLE_AI_API_KEY` if they were ever shared, committed, or pasted into screenshots.
- If you rotate the public Supabase key, update the frontend `NEXT_PUBLIC_SUPABASE_ANON_KEY` too.
- Migration `005_sessions_auth_user_link.sql` backfills `auth_user_id` from legacy `device_hint` values so returning users can recover their existing backend workspace across browsers.

### Auth Smoke Test

After backend and frontend deployment, verify these flows:

1. Sign up a new user, complete onboarding, and confirm they land on `/dashboard`.
2. Log out and log back in with the same user in the same browser; they should return to `/dashboard`, not `/onboarding`.
3. Open a fresh browser profile or incognito window, log in as that same user, and confirm the existing workspace is recovered.
4. Refresh `/dashboard` and confirm the app stays on the dashboard after auth hydration completes.
