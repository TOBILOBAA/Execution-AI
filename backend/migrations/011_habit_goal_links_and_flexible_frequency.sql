-- ============================================================
-- Migration 011: Habit strategic links + flexible frequency
-- ============================================================

alter table foundational_habits
  add column if not exists yearly_goal_id uuid references yearly_goals(id) on delete set null,
  add column if not exists monthly_goal_id uuid references monthly_goals(id) on delete set null,
  add column if not exists weekly_goal_id uuid references weekly_goals(id) on delete set null;

alter table foundational_habits
  drop constraint if exists foundational_habits_frequency_check;

alter table foundational_habits
  add constraint foundational_habits_frequency_check
    check (frequency in ('daily','weekly','weekdays','3x_week','5x_week','weekends','flexible'));

alter table foundational_habits
  drop constraint if exists foundational_habits_single_goal_link_check;

alter table foundational_habits
  add constraint foundational_habits_single_goal_link_check
    check (num_nonnulls(yearly_goal_id, monthly_goal_id, weekly_goal_id) <= 1);

create index if not exists idx_habits_yearly_goal on foundational_habits(yearly_goal_id);
create index if not exists idx_habits_monthly_goal on foundational_habits(monthly_goal_id);
create index if not exists idx_habits_weekly_goal on foundational_habits(weekly_goal_id);
