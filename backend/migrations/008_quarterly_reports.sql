-- ============================================================
-- Migration 008: Quarterly report snapshots
-- ============================================================
--
-- Adds the `quarterly` report_type plus the supporting columns and indexes.
--
-- Decisions:
--   * `period_quarter` is its own typed smallint column (not overloaded onto
--     `period_month`). Keeps lookup queries readable: a row with
--     report_type='quarterly' has period_quarter ∈ {1,2,3,4} and a NULL
--     period_month, so the existing monthly partial unique index never
--     conflicts with quarterly rows.
--   * Yearly rows continue to use period_year only; quarterly rows use
--     (period_year, period_quarter).
--
-- Spec refs: §9b (Quarterly tab), §11i (POST /reports/quarterly/generate).
-- AGENTS branch note: this migration was authored on feat/dashboard-reports
-- before feat/dashboard-goals shipped its 008_hierarchy_required_links.sql.
-- On rebase, renumber whichever branch lands second.
-- ============================================================

-- 1. Allow report_type='quarterly' on the existing CHECK constraint.
alter table report_snapshots
  drop constraint if exists report_snapshots_report_type_check;

alter table report_snapshots
  add constraint report_snapshots_report_type_check
  check (report_type in ('daily','weekly','monthly','quarterly','yearly'));

-- 2. Add the period_quarter column.
alter table report_snapshots
  add column if not exists period_quarter smallint
    check (period_quarter is null or period_quarter between 1 and 4);

-- 3. Tailored fields persisted as typed columns rather than JSON blobs.
--    Spec §6 / §8a require these on every weekly+ recap; storing typed
--    columns means downstream queries (e.g., "show me every report whose
--    tailored_pattern is null") don't need JSONB lookups.
alter table report_snapshots
  add column if not exists tailored_pattern text;
alter table report_snapshots
  add column if not exists tailored_action  text;

-- 4. Partial unique index for quarterly snapshots.
create unique index if not exists uq_report_snapshots_quarterly
  on report_snapshots(session_id, report_type, period_year, period_quarter)
  where report_type = 'quarterly';

-- 5. Helpful read index for the Reports tab's per-year quarterly listing.
create index if not exists idx_report_snapshots_quarterly_listing
  on report_snapshots(session_id, period_year, period_quarter)
  where report_type = 'quarterly';
