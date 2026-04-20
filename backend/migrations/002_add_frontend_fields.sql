-- ============================================================
-- Migration 002: Add fields required by frontend schema updates
-- ============================================================

-- ─── Yearly Goals: add target_date ────────────────────────────────────────────
alter table yearly_goals
  add column if not exists target_date date;

-- ─── Monthly Goals: add category_id, target_date, workload ───────────────────
alter table monthly_goals
  add column if not exists category_id uuid references categories(id) on delete set null,
  add column if not exists target_date date,
  add column if not exists workload text;

-- ─── Weekly Goals: add target_day, goal_type ──────────────────────────────────
alter table weekly_goals
  add column if not exists target_day text
    check (target_day in ('mon','tue','wed','thu','fri','sat','sun')),
  add column if not exists goal_type text
    check (goal_type in ('tactical','operational'));

-- ─── Foundational Habits: expand frequency enum + add category_id ─────────────
-- PostgreSQL enums can't be altered in-place cleanly.
-- We change the column to text and apply a check constraint instead.
alter table foundational_habits
  alter column frequency type text;

alter table foundational_habits
  drop constraint if exists foundational_habits_frequency_check;

alter table foundational_habits
  add constraint foundational_habits_frequency_check
    check (frequency in ('daily','weekly','weekdays','3x_week','5x_week','weekends'));

alter table foundational_habits
  add column if not exists category_id uuid references categories(id) on delete set null;
