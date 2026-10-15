-- The daily is now played on the server: it keeps each player's game, scores every move,
-- and times each card for the speed bonus. Results can't be self-reported anymore.
alter table public.daily_plays
  add column state jsonb,                         -- card, chain, letters, status (null on old rows)
  add column card_shown_at timestamptz,           -- when the current card appeared (speed bonus clock)
  add column moves int not null default 0,        -- also the optimistic-lock version
  add column fast_links int not null default 0,   -- links answered within 20 seconds
  add column verified boolean not null default true; -- false = carried over from a phone mid-game at launch

-- Rank points: daily win 10 + 2 per unused letter, daily loss 2, plus 1 per fast link.
create or replace function public.player_points()
returns table (player_id uuid, points bigint)
language sql
stable
as $$
  select d.player_id,
         sum(case when d.won then 10 + 2 * (5 - coalesce(d.letters, 0)) else 2 end + d.fast_links)::bigint
  from public.daily_plays d
  where d.finished_at is not null and d.verified
  group by d.player_id;
$$;
revoke execute on function public.player_points() from public, anon, authenticated;

-- A row now exists as soon as someone opens the daily, so "started" means they made a move
-- (old rows, from before server play, were only created on a first move).
create or replace function public.admin_stats(today_number int) returns json
language sql stable as $$
  with et_midnight as (
    select (date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York') as ts
  ),
  plays as (select * from daily_plays where state is null or moves > 0)
  select json_build_object(
    'live_games', (
      select count(distinct c.id) from challenges c join challenge_players p on p.challenge_id = c.id
      where c.status = 'playing' and p.last_seen > now() - interval '30 seconds'),
    'players_on_screen', (
      select count(*) from challenge_players p join challenges c on c.id = p.challenge_id
      where c.status in ('lobby', 'playing') and p.last_seen > now() - interval '30 seconds'),
    'games_in_progress', (select count(*) from challenges where status = 'playing'),
    'lobbies_open', (select count(*) from challenges where status = 'lobby' and created_at > now() - interval '24 hours'),
    'challenges_today', (select count(*) from challenges, et_midnight where created_at >= et_midnight.ts),
    'finished_today', (select count(*) from challenges, et_midnight where status = 'finished' and updated_at >= et_midnight.ts),
    'challenges_total', (select count(*) from challenges),
    'daily_started', (select count(*) from plays where puzzle_number = today_number),
    'daily_finished', (select count(*) from plays where puzzle_number = today_number and finished_at is not null),
    'daily_won', (select count(*) from plays where puzzle_number = today_number and won),
    'daily_avg_links', (select round(avg(links), 1) from plays where puzzle_number = today_number and finished_at is not null),
    'daily_last7', (
      select json_agg(json_build_object(
        'number', n,
        'started', (select count(*) from plays where puzzle_number = n),
        'finished', (select count(*) from plays where puzzle_number = n and finished_at is not null)
      ) order by n)
      from generate_series(greatest(1, today_number - 6), today_number) as n),
    'push_devices', (select count(*) from push_subscriptions),
    'push_daily', (select count(*) from push_subscriptions where daily)
  );
$$;
revoke execute on function public.admin_stats(int) from public, anon, authenticated;
