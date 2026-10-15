-- Anonymous daily play log: one row per device per puzzle. No names, just the
-- anonymous cookie id the game already uses.
create table public.daily_plays (
  puzzle_number int not null,
  player_id uuid not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  won boolean,
  links int check (links between 0 and 10),
  letters int check (letters between 0 and 5),
  duration_ms int check (duration_ms >= 0),
  primary key (puzzle_number, player_id)
);
create index daily_plays_finished_idx on public.daily_plays (puzzle_number) where finished_at is not null;
alter table public.daily_plays enable row level security;

-- Everything the admin page shows, in one round trip. Only the server (secret key) may call it.
create function public.admin_stats(today_number int) returns json
language sql stable as $$
  with et_midnight as (
    select (date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York') as ts
  )
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
    'daily_started', (select count(*) from daily_plays where puzzle_number = today_number),
    'daily_finished', (select count(*) from daily_plays where puzzle_number = today_number and finished_at is not null),
    'daily_won', (select count(*) from daily_plays where puzzle_number = today_number and won),
    'daily_avg_links', (select round(avg(links), 1) from daily_plays where puzzle_number = today_number and finished_at is not null),
    'daily_last7', (
      select json_agg(json_build_object(
        'number', n,
        'started', (select count(*) from daily_plays where puzzle_number = n),
        'finished', (select count(*) from daily_plays where puzzle_number = n and finished_at is not null)
      ) order by n)
      from generate_series(greatest(1, today_number - 6), today_number) as n),
    'push_devices', (select count(*) from push_subscriptions),
    'push_daily', (select count(*) from push_subscriptions where daily)
  );
$$;
revoke execute on function public.admin_stats(int) from public, anon, authenticated;
