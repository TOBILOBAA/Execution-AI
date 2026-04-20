-- ============================================================
-- Migration 006: Scope report snapshot uniqueness by report type
-- ============================================================

drop index if exists uq_report_snapshots_daily;
drop index if exists uq_report_snapshots_weekly;
drop index if exists uq_report_snapshots_monthly;
drop index if exists uq_report_snapshots_yearly;

create unique index if not exists uq_report_snapshots_daily
  on report_snapshots(session_id, report_type, period_date)
  where report_type = 'daily';

create unique index if not exists uq_report_snapshots_weekly
  on report_snapshots(session_id, report_type, period_year, period_week)
  where report_type = 'weekly';

create unique index if not exists uq_report_snapshots_monthly
  on report_snapshots(session_id, report_type, period_year, period_month)
  where report_type = 'monthly';

create unique index if not exists uq_report_snapshots_yearly
  on report_snapshots(session_id, report_type, period_year)
  where report_type = 'yearly';
