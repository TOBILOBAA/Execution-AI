-- ============================================================
-- Migration 008: Require strict hierarchy links + main-goal caps
-- ============================================================

-- ─── Backfill orphaned monthly goals ─────────────────────────
with monthly_parent_candidates as (
  select
    mg.id as monthly_goal_id,
    yg.id as yearly_goal_id,
    row_number() over (
      partition by mg.id
      order by
        case
          when mg.category_id is not null and yg.category_id = mg.category_id then 0
          else 1
        end,
        abs(
          extract(
            epoch from (
              coalesce(yg.target_date, make_date(mg.year::int, mg.month::int, 1))::timestamp
              - make_date(mg.year::int, mg.month::int, 1)::timestamp
            )
          )
        ),
        yg.created_at
    ) as rn
  from monthly_goals mg
  join yearly_goals yg
    on yg.session_id = mg.session_id
   and yg.year = mg.year
  where mg.yearly_goal_id is null
)
update monthly_goals mg
set yearly_goal_id = candidate.yearly_goal_id
from monthly_parent_candidates candidate
where mg.id = candidate.monthly_goal_id
  and candidate.rn = 1;

do $$
declare orphan record;
begin
  for orphan in
    select id, title, year, month
    from monthly_goals
    where yearly_goal_id is null
  loop
    raise warning 'Deleting orphan monthly_goal % (%) for %-%: no yearly parent match found.',
      orphan.id, orphan.title, orphan.year, orphan.month;
  end loop;

  delete from monthly_goals
  where yearly_goal_id is null;
end $$;

-- ─── Backfill orphaned weekly goals ──────────────────────────
with weekly_parent_candidates as (
  select
    wg.id as weekly_goal_id,
    mg.id as monthly_goal_id,
    row_number() over (
      partition by wg.id
      order by
        case
          when wp.monthly_plan_id is not null and mg.monthly_plan_id = wp.monthly_plan_id then 0
          else 1
        end,
        case when mg.is_main then 0 else 1 end,
        mg.created_at
    ) as rn
  from weekly_goals wg
  left join weekly_plans wp
    on wp.id = wg.weekly_plan_id
  join monthly_goals mg
    on mg.session_id = wg.session_id
   and mg.year = wg.year
   and mg.month = wg.month
  where wg.monthly_goal_id is null
)
update weekly_goals wg
set monthly_goal_id = candidate.monthly_goal_id
from weekly_parent_candidates candidate
where wg.id = candidate.weekly_goal_id
  and candidate.rn = 1;

do $$
declare orphan record;
begin
  for orphan in
    select id, title, year, week_number
    from weekly_goals
    where monthly_goal_id is null
  loop
    raise warning 'Deleting orphan weekly_goal % (%) for year %, week %: no monthly parent match found.',
      orphan.id, orphan.title, orphan.year, orphan.week_number;
  end loop;

  delete from weekly_goals
  where monthly_goal_id is null;
end $$;

-- ─── Backfill orphaned daily priorities ──────────────────────
with daily_parent_candidates as (
  select
    dp.id as daily_priority_id,
    wg.id as weekly_goal_id,
    row_number() over (
      partition by dp.id
      order by
        case when wg.is_main then 0 else 1 end,
        wg.created_at
    ) as rn
  from daily_priorities dp
  join daily_plans dpl
    on dpl.id = dp.daily_plan_id
  join weekly_plans wp
    on wp.id = dpl.weekly_plan_id
  join weekly_goals wg
    on wg.session_id = dp.session_id
   and wg.year = extract(year from dp.date)::smallint
   and wg.week_number = wp.week_number
  where dp.weekly_goal_id is null
)
update daily_priorities dp
set weekly_goal_id = candidate.weekly_goal_id
from daily_parent_candidates candidate
where dp.id = candidate.daily_priority_id
  and candidate.rn = 1;

do $$
declare orphan record;
begin
  for orphan in
    select id, title, date
    from daily_priorities
    where weekly_goal_id is null
  loop
    raise warning 'Deleting orphan daily_priority % (%) for %: no weekly parent match found.',
      orphan.id, orphan.title, orphan.date;
  end loop;

  delete from daily_priorities
  where weekly_goal_id is null;
end $$;

-- ─── Require the parent links going forward ──────────────────
alter table monthly_goals
  alter column yearly_goal_id set not null;

alter table weekly_goals
  alter column monthly_goal_id set not null;

alter table daily_priorities
  alter column weekly_goal_id set not null;

-- ─── Main-goal cap guards (max 3 per period) ────────────────
create or replace function enforce_monthly_main_goal_cap()
returns trigger language plpgsql as $$
begin
  if new.is_main then
    if (
      select count(*)
      from monthly_goals
      where session_id = new.session_id
        and year = new.year
        and month = new.month
        and is_main = true
        and id <> new.id
    ) >= 3 then
      raise exception 'monthly_goals main-goal cap exceeded for session %, year %, month %',
        new.session_id, new.year, new.month
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_monthly_main_goal_cap on monthly_goals;
create trigger trg_monthly_main_goal_cap
before insert or update of is_main, session_id, year, month
on monthly_goals
for each row
execute function enforce_monthly_main_goal_cap();

create or replace function enforce_weekly_main_goal_cap()
returns trigger language plpgsql as $$
begin
  if new.is_main then
    if (
      select count(*)
      from weekly_goals
      where session_id = new.session_id
        and year = new.year
        and week_number = new.week_number
        and is_main = true
        and id <> new.id
    ) >= 3 then
      raise exception 'weekly_goals main-goal cap exceeded for session %, year %, week %',
        new.session_id, new.year, new.week_number
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_weekly_main_goal_cap on weekly_goals;
create trigger trg_weekly_main_goal_cap
before insert or update of is_main, session_id, year, week_number
on weekly_goals
for each row
execute function enforce_weekly_main_goal_cap();

create or replace function enforce_daily_main_priority_cap()
returns trigger language plpgsql as $$
begin
  if new.is_main then
    if (
      select count(*)
      from daily_priorities
      where session_id = new.session_id
        and date = new.date
        and is_main = true
        and id <> new.id
    ) >= 3 then
      raise exception 'daily_priorities main-goal cap exceeded for session %, date %',
        new.session_id, new.date
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_daily_main_priority_cap on daily_priorities;
create trigger trg_daily_main_priority_cap
before insert or update of is_main, session_id, date
on daily_priorities
for each row
execute function enforce_daily_main_priority_cap();
