-- ============================================================
-- Migration 009: Home dashboard support
-- ============================================================
--
-- Adds sticky recap queue storage on sessions and allows report snapshots
-- to be marked `stale` after same-day execution changes.
--
-- Spec refs: §5b, §5c, §6, §11g, §12
-- ============================================================

alter table sessions
  add column if not exists pending_recaps jsonb not null default '[]'::jsonb;

alter table sessions
  add column if not exists handled_recaps jsonb not null default '[]'::jsonb;

alter table report_snapshots
  drop constraint if exists report_snapshots_status_check;

alter table report_snapshots
  add constraint report_snapshots_status_check
  check (status in ('pending','generating','ready','failed','stale'));
