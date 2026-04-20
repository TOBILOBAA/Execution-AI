alter table sessions
  add column if not exists week_starts_on text;

alter table sessions
  drop constraint if exists sessions_week_starts_on_check;

alter table sessions
  add constraint sessions_week_starts_on_check
  check (week_starts_on is null or week_starts_on in ('sunday', 'monday'));
