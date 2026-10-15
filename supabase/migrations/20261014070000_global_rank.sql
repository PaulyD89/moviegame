-- Global ranking: everyone's all-time points from finished dailies and won challenges.
--   Daily win:        10 pts + 2 per unused letter (a clean win = 20)
--   Daily loss:       2 pts for finishing
--   Challenge win:    5 pts per player beaten
-- Ties share a rank ("1, 2, 2, 4"). Players with no points aren't ranked yet.
create or replace function public.player_points()
returns table (player_id uuid, points bigint)
language sql
stable
as $$
  with scores as (
    select d.player_id, case when d.won then 10 + 2 * (5 - coalesce(d.letters, 0)) else 2 end as pts
    from public.daily_plays d
    where d.finished_at is not null
    union all
    select c.winner_id, 5 * (count(*) - 1)
    from public.challenges c
    join public.challenge_players p on p.challenge_id = c.id
    where c.status = 'finished' and c.winner_id is not null
    group by c.id, c.winner_id
  )
  select s.player_id, sum(s.pts)::bigint from scores s group by s.player_id having sum(s.pts) > 0;
$$;

create or replace function public.global_rank(p_player uuid)
returns json
language sql
stable
as $$
  with pts as (select * from public.player_points()),
  me as (select coalesce((select points from pts where player_id = p_player), 0) as points)
  select json_build_object(
    'points', me.points,
    'rank', case when me.points > 0 then 1 + (select count(*) from pts where pts.points > me.points) end,
    'ranked', (select count(*) from pts)
  )
  from me;
$$;

revoke execute on function public.player_points() from public, anon, authenticated;
revoke execute on function public.global_rank(uuid) from public, anon, authenticated;
