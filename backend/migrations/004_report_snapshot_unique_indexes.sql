-- ============================================================
-- Migration 004: Make report snapshot upserts deterministic
-- ============================================================

-- Daily reports: one snapshot per session/date
create unique index if not exists uq_report_snapshots_daily
  on report_snapshots(session_id, report_type, period_date);

-- Weekly reports: one snapshot per session/year/week
create unique index if not exists uq_report_snapshots_weekly
  on report_snapshots(session_id, report_type, period_year, period_week);

-- Monthly reports: one snapshot per session/year/month
create unique index if not exists uq_report_snapshots_monthly
  on report_snapshots(session_id, report_type, period_year, period_month);

-- Yearly reports: one snapshot per session/year
create unique index if not exists uq_report_snapshots_yearly
  on report_snapshots(session_id, report_type, period_year);
