-- Effort / time budget for weekly goals (mirrors monthly_goals.workload)
alter table weekly_goals
  add column if not exists workload text;
