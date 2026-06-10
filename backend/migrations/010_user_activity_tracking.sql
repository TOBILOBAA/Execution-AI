alter table sessions
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_active_at timestamptz,
  add column if not exists last_opened_date_local date;

create table if not exists daily_user_activity (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  auth_user_id text,
  activity_date date not null,
  timezone text not null default 'UTC',
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  opened_app boolean not null default false,
  completed_onboarding boolean not null default false,
  created_yearly_goal boolean not null default false,
  created_monthly_goal boolean not null default false,
  created_weekly_goal boolean not null default false,
  created_daily_plan boolean not null default false,
  opened_next_day_review boolean not null default false,
  approved_next_day_review boolean not null default false,
  opened_reports boolean not null default false,
  handled_recap boolean not null default false,
  completed_tasks_count integer not null default 0,
  completed_habits_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, activity_date)
);

create index if not exists idx_daily_user_activity_session_date
  on daily_user_activity(session_id, activity_date desc);

create index if not exists idx_daily_user_activity_auth_date
  on daily_user_activity(auth_user_id, activity_date desc);

drop trigger if exists trg_daily_user_activity_updated_at on daily_user_activity;
create trigger trg_daily_user_activity_updated_at
before update on daily_user_activity
for each row execute function update_updated_at();
