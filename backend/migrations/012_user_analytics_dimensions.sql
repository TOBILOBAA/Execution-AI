alter table daily_user_activity
  add column if not exists reached_dashboard boolean not null default false,
  add column if not exists device_type text,
  add column if not exists device_family text,
  add column if not exists os_name text,
  add column if not exists browser_name text,
  add column if not exists main_tasks_total integer not null default 0,
  add column if not exists main_tasks_completed integer not null default 0,
  add column if not exists secondary_tasks_total integer not null default 0,
  add column if not exists secondary_tasks_completed integer not null default 0,
  add column if not exists habits_total integer not null default 0,
  add column if not exists main_goal_completed boolean not null default false,
  add column if not exists completed_any_meaningful_work boolean not null default false,
  add column if not exists daily_completion_score integer not null default 0;

create table if not exists user_device_activity (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  session_id uuid references sessions(id) on delete cascade,
  device_type text not null,
  device_family text not null,
  os_name text not null,
  browser_name text not null,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id, session_id, device_type, device_family, os_name, browser_name)
);

create index if not exists idx_user_device_activity_auth_last_seen
  on user_device_activity(auth_user_id, last_seen_at desc);

drop trigger if exists trg_user_device_activity_updated_at on user_device_activity;
create trigger trg_user_device_activity_updated_at
before update on user_device_activity
for each row execute function update_updated_at();
