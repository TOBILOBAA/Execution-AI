-- ============================================================
-- Migration 005: Link backend workspaces to authenticated users
-- ============================================================

alter table sessions
  add column if not exists auth_user_id text;

-- Backfill historic sessions created by the frontend, which used to send the
-- auth user id via device_hint.
update sessions
set auth_user_id = device_hint
where auth_user_id is null
  and device_hint is not null
  and length(trim(device_hint)) > 0;

-- Older builds could create multiple sessions for the same user across browsers.
-- Keep lookup fast and deterministic without forcing a destructive merge here.
create index if not exists idx_sessions_auth_user_id
  on sessions(auth_user_id, updated_at desc, created_at desc)
  where auth_user_id is not null;
