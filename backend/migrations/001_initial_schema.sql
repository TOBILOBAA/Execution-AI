-- ============================================================
-- Execution AI — Initial Relational Schema
-- Target: Supabase (PostgreSQL 15+)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── Sessions / Workspaces ────────────────────────────────────────────────────
create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- lightweight anon entry point; extend with user_id when auth is added
  device_hint     text,
  onboarding_step smallint not null default 1,       -- 1-4
  onboarding_done boolean  not null default false,
  timezone        text not null default 'UTC'
);

-- ─── Categories ───────────────────────────────────────────────────────────────
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  name        text not null,
  icon        text not null default 'category',      -- Material Symbol name
  color       text,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_categories_session on categories(session_id);

-- ─── Yearly Goals ─────────────────────────────────────────────────────────────
create table if not exists yearly_goals (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  category_id  uuid references categories(id) on delete set null,
  title        text not null,
  description  text,
  year         smallint not null,
  status       text not null default 'active'
                 check (status in ('active','completed','missed','locked','pending')),
  progress     smallint not null default 0 check (progress between 0 and 100),
  ai_suggested boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_yearly_goals_session_year on yearly_goals(session_id, year);

-- ─── Monthly Plans ────────────────────────────────────────────────────────────
-- One record per month per session. Stores AI draft + user-approved version.
create table if not exists monthly_plans (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references sessions(id) on delete cascade,
  year            smallint not null,
  month           smallint not null check (month between 1 and 12),
  status          text not null default 'draft'
                    check (status in ('draft','active','completed','locked')),
  -- temporal snapshot at generation time
  days_in_month   smallint not null,
  days_remaining  smallint not null,
  -- AI generation metadata
  ai_draft        jsonb,     -- raw AI output before user approval
  ai_generated_at timestamptz,
  -- user-approved final plan (nullable until approved)
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_id, year, month)
);

create index if not exists idx_monthly_plans_session on monthly_plans(session_id, year, month);

-- ─── Monthly Goals ────────────────────────────────────────────────────────────
create table if not exists monthly_goals (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references sessions(id) on delete cascade,
  monthly_plan_id  uuid not null references monthly_plans(id) on delete cascade,
  yearly_goal_id   uuid references yearly_goals(id) on delete set null,
  title            text not null,
  description      text,
  year             smallint not null,
  month            smallint not null check (month between 1 and 12),
  status           text not null default 'active'
                     check (status in ('active','completed','missed','locked','pending')),
  progress         smallint not null default 0 check (progress between 0 and 100),
  priority         text not null default 'medium'
                     check (priority in ('high','medium','low')),
  is_main          boolean not null default false,
  ai_suggested     boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_monthly_goals_plan on monthly_goals(monthly_plan_id);
create index if not exists idx_monthly_goals_session on monthly_goals(session_id, year, month);

-- ─── Weekly Plans ─────────────────────────────────────────────────────────────
create table if not exists weekly_plans (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references sessions(id) on delete cascade,
  monthly_plan_id uuid references monthly_plans(id) on delete set null,
  year            smallint not null,
  month           smallint not null check (month between 1 and 12),
  week_number     smallint not null,   -- ISO week number 1-53
  week_start      date not null,
  week_end        date not null,
  status          text not null default 'draft'
                    check (status in ('draft','active','completed','locked')),
  days_remaining  smallint not null,
  ai_draft        jsonb,
  ai_generated_at timestamptz,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_id, year, week_number)
);

create index if not exists idx_weekly_plans_session on weekly_plans(session_id, year, week_number);

-- ─── Weekly Goals ─────────────────────────────────────────────────────────────
create table if not exists weekly_goals (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references sessions(id) on delete cascade,
  weekly_plan_id  uuid not null references weekly_plans(id) on delete cascade,
  monthly_goal_id uuid references monthly_goals(id) on delete set null,
  title           text not null,
  description     text,
  year            smallint not null,
  month           smallint not null,
  week_number     smallint not null,
  status          text not null default 'active'
                    check (status in ('active','completed','missed','locked','pending')),
  progress        smallint not null default 0 check (progress between 0 and 100),
  is_main         boolean not null default false,
  ai_suggested    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_weekly_goals_plan on weekly_goals(weekly_plan_id);
create index if not exists idx_weekly_goals_session on weekly_goals(session_id, year, week_number);

-- ─── Daily Plans ──────────────────────────────────────────────────────────────
create table if not exists daily_plans (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references sessions(id) on delete cascade,
  weekly_plan_id  uuid references weekly_plans(id) on delete set null,
  date            date not null,
  status          text not null default 'draft'
                    check (status in ('draft','active','completed','locked')),
  ai_draft        jsonb,
  ai_generated_at timestamptz,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_id, date)
);

create index if not exists idx_daily_plans_session on daily_plans(session_id, date);

-- ─── Daily Priorities (main tasks) ────────────────────────────────────────────
create table if not exists daily_priorities (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references sessions(id) on delete cascade,
  daily_plan_id     uuid not null references daily_plans(id) on delete cascade,
  weekly_goal_id    uuid references weekly_goals(id) on delete set null,
  title             text not null,
  description       text,
  date              date not null,
  status            text not null default 'active'
                      check (status in ('active','completed','missed','locked','pending')),
  completed         boolean not null default false,
  completed_at      timestamptz,
  priority          text not null default 'medium'
                      check (priority in ('high','medium','low')),
  estimated_minutes smallint,
  is_main           boolean not null default true,
  tag               text,
  ai_suggested      boolean not null default false,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_daily_priorities_plan on daily_priorities(daily_plan_id);
create index if not exists idx_daily_priorities_date on daily_priorities(session_id, date);

-- ─── Foundational Habits ──────────────────────────────────────────────────────
create table if not exists foundational_habits (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  name        text not null,
  icon        text not null default 'check_circle',
  frequency   text not null default 'daily'
                check (frequency in ('daily','weekly')),
  active      boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_habits_session on foundational_habits(session_id);

-- ─── Habit Logs (daily completion records) ────────────────────────────────────
create table if not exists habit_logs (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  habit_id    uuid not null references foundational_habits(id) on delete cascade,
  date        date not null,
  completed   boolean not null default false,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (habit_id, date)
);

create index if not exists idx_habit_logs_session_date on habit_logs(session_id, date);

-- ─── Report Snapshots ─────────────────────────────────────────────────────────
create table if not exists report_snapshots (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references sessions(id) on delete cascade,
  report_type      text not null
                     check (report_type in ('daily','weekly','monthly','yearly')),
  -- Period identifiers (nullable fields used depending on report_type)
  period_date      date,           -- for daily
  period_week      smallint,       -- ISO week number, for weekly
  period_month     smallint,       -- 1-12, for monthly/yearly
  period_year      smallint not null,
  -- Computed metrics snapshot (code-computed, not LLM)
  metrics          jsonb not null default '{}',
  -- AI-generated narrative content
  ai_narrative     jsonb,          -- structured reflection from Gemini
  ai_generated_at  timestamptz,
  -- Generation status
  status           text not null default 'pending'
                     check (status in ('pending','generating','ready','failed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_reports_session_type on report_snapshots(session_id, report_type, period_year);

-- ─── AI Generation Log (audit / cost tracking) ────────────────────────────────
create table if not exists ai_generations (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references sessions(id) on delete cascade,
  generation_type text not null,       -- e.g. 'monthly_plan', 'daily_report'
  model_name      text,
  prompt_tokens   int,
  output_tokens   int,
  latency_ms      int,
  success         boolean not null default true,
  error_message   text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_ai_gen_session on ai_generations(session_id, created_at desc);

-- ─── Automatic updated_at trigger ─────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply trigger to all tables with updated_at
do $$
declare t text;
begin
  foreach t in array array[
    'sessions','yearly_goals','monthly_plans','monthly_goals',
    'weekly_plans','weekly_goals','daily_plans','daily_priorities',
    'foundational_habits','report_snapshots'
  ]
  loop
    execute format(
      'create trigger trg_%s_updated_at before update on %s
       for each row execute function update_updated_at()',
      t, t
    );
  end loop;
end;
$$;
