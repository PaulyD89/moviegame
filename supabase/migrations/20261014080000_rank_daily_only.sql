-- Global ranking counts the daily only: one game per player per day can't be farmed,
-- while challenge wins could be (play yourself from a second browser).
--   Daily win:  10 pts + 2 per unused letter (a clean win = 20)
--   Daily loss: 2 pts for finishing
create or replace function public.player_points()
returns table (player_id uuid, points bigint)
language sql
stable
as $$
  select d.player_id, sum(case when d.won then 10 + 2 * (5 - coalesce(d.letters, 0)) else 2 end)::bigint
  from public.daily_plays d
  where d.finished_at is not null
  group by d.player_id;
$$;

revoke execute on function public.player_points() from public, anon, authenticated;
