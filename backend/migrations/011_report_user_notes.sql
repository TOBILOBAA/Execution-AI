-- ============================================================
-- Migration 011: User notes on report snapshots
-- ============================================================
--
-- Lets users attach their own recap note to daily / weekly / monthly /
-- quarterly / yearly reports. These notes can then be surfaced in the UI and
-- folded into later report context so higher-period reviews stay grounded in
-- what the user said actually happened.
-- ============================================================

alter table report_snapshots
  add column if not exists user_note text;
