-- Which browser each daily player uses (Instagram app, Safari...), and next-day return for /admin.
alter table daily_plays add column if not exists browser text;

create or replace function public.admin_browsers(days integer)
 returns table(browser text, players bigint, moved bigint, finished bigint)
 language sql
 stable
as $function$
  select browser,
         count(distinct player_id) as players,
         count(distinct player_id) filter (where moves > 0) as moved,
         count(distinct player_id) filter (where finished_at is not null) as finished
  from public.daily_plays
  where started_at > now() - make_interval(days => days)
    and browser is not null
  group by 1
  order by 2 desc;
$function$;

-- Of the players who made a move on a puzzle, how many opened the next one. "puzzle" rows cover
-- the last 7 puzzles (the newest is still filling in today); the breakdowns only use finished
-- next days, so a half-day doesn't drag them down.
create or replace function public.admin_returns(today_number integer)
 returns table(dim text, label text, players bigint, back bigint)
 language sql
 stable
as $function$
  with base as (
    select p.puzzle_number as n,
           case when p.won then 'Won' when p.finished_at is not null then 'Lost' else 'Quit partway' end as outcome,
           coalesce(p.source, 'Unknown') as source,
           coalesce(p.browser, 'Unknown') as browser,
           exists (select 1 from public.daily_plays x
                   where x.player_id = p.player_id and x.puzzle_number = p.puzzle_number + 1) as back
    from public.daily_plays p
    where p.moves > 0 and p.puzzle_number between today_number - 7 and today_number - 1
  ), done as (select * from base where n < today_number - 1)
  select 'puzzle', n::text, count(*), count(*) filter (where back) from base group by n
  union all
  select 'outcome', outcome, count(*), count(*) filter (where back) from done group by outcome
  union all
  select 'source', source, count(*), count(*) filter (where back) from done where source <> 'Unknown' group by source
  union all
  select 'browser', browser, count(*), count(*) filter (where back) from done where browser <> 'Unknown' group by browser;
$function$;
