-- Growth for the admin page: the last 30 puzzles day by day, plus all-time totals.
-- A daily "player" made at least one move (or is from before rows existed on open).
-- New = first daily ever; returning = also played the day before; active = daily or challenge move that day (ET).
create or replace function public.admin_growth(today_number int) returns json
language sql stable as $$
  with plays as (
    select player_id, puzzle_number from daily_plays where state is null or moves > 0
  ),
  firsts as (select player_id, min(puzzle_number) as first from plays group by player_id),
  days as (
    select n, ('2026-10-14'::date + (n - 1)) as d
    from generate_series(greatest(1, today_number - 29), today_number) as n
  ),
  move_days as (
    select distinct (created_at at time zone 'America/New_York')::date as d, player_id from challenge_moves
  ),
  rematched as (select rematch_id as id from challenges where rematch_id is not null),
  ch as (
    select (created_at at time zone 'America/New_York')::date as d, id in (select id from rematched) as is_rematch
    from challenges
  )
  select json_build_object(
    'days', (
      select json_agg(json_build_object(
        'number', days.n,
        'date', days.d,
        'players', (select count(*) from plays p where p.puzzle_number = days.n),
        'finished', (select count(*) from daily_plays x where x.puzzle_number = days.n and x.finished_at is not null),
        'won', (select count(*) from daily_plays x where x.puzzle_number = days.n and x.won),
        'new_players', (select count(*) from firsts f where f.first = days.n),
        'returning', (
          select count(*) from plays p
          where p.puzzle_number = days.n
            and exists (select 1 from plays q where q.player_id = p.player_id and q.puzzle_number = days.n - 1)),
        'prev_players', (select count(*) from plays p where p.puzzle_number = days.n - 1),
        'active', (
          select count(*) from (
            select player_id from plays where puzzle_number = days.n
            union
            select player_id from move_days m where m.d = days.d
          ) u),
        'challenges', (select count(*) from ch where ch.d = days.d),
        'rematches', (select count(*) from ch where ch.d = days.d and ch.is_rematch)
      ) order by days.n)
      from days),
    'totals', json_build_object(
      'players', (select count(*) from (select player_id from plays union select player_id from challenge_players) u),
      'daily_games', (select count(*) from daily_plays where finished_at is not null),
      'challenges', (select count(*) from challenges),
      'challenges_finished', (select count(*) from challenges where status = 'finished')
    )
  );
$$;
revoke execute on function public.admin_growth(int) from public, anon, authenticated;
