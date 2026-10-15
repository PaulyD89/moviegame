-- 1) Streak reminder: nightly-reminder devices whose player has a live win streak and
--    hasn't finished today's chain yet. Streak = consecutive won puzzles ending yesterday.
alter table public.daily_puzzles add column streak_reminded_at timestamptz;

create or replace function public.streak_reminder_targets(today int)
returns table (endpoint text, p256dh text, auth text, streak bigint)
language sql
stable
as $$
  with wins as (
    select player_id, puzzle_number,
           puzzle_number - row_number() over (partition by player_id order by puzzle_number) as grp
    from public.daily_plays
    where won and puzzle_number < today
  ),
  streaks as (
    select player_id, count(*) as n, max(puzzle_number) as last
    from wins group by player_id, grp
  )
  select s.endpoint, s.p256dh, s.auth, st.n
  from public.push_subscriptions s
  join streaks st on st.player_id = s.player_id and st.last = today - 1
  where s.daily
    and not exists (
      select 1 from public.daily_plays d
      where d.player_id = s.player_id and d.puzzle_number = today and d.finished_at is not null
    );
$$;
revoke execute on function public.streak_reminder_targets(int) from public, anon, authenticated;

-- 2) Monthly rank: the same points, counted from a starting puzzle (1 = all time).
drop function if exists public.global_rank(uuid);
drop function if exists public.player_points();

create function public.player_points(p_from int default 1)
returns table (player_id uuid, points bigint)
language sql
stable
as $$
  select d.player_id,
         sum(case when d.won then 10 + 2 * (5 - coalesce(d.letters, 0)) else 2 end + d.fast_links)::bigint
  from public.daily_plays d
  where d.finished_at is not null and d.verified and d.puzzle_number >= p_from
  group by d.player_id;
$$;

create function public.global_rank(p_player uuid, p_from int default 1)
returns json
language sql
stable
as $$
  with pts as (select * from public.player_points(p_from)),
  me as (select coalesce((select points from pts where player_id = p_player), 0) as points)
  select json_build_object(
    'points', me.points,
    'rank', case when me.points > 0 then 1 + (select count(*) from pts where pts.points > me.points) end
  )
  from me;
$$;
revoke execute on function public.player_points(int) from public, anon, authenticated;
revoke execute on function public.global_rank(uuid, int) from public, anon, authenticated;

-- 3) Error log for the admin page: server errors (via instrumentation) and phone errors.
create table public.app_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  source text not null,          -- 'server' | 'phone' | 'cron'
  path text,
  message text not null,
  digest text
);
create index app_errors_at_idx on public.app_errors (at desc);
alter table public.app_errors enable row level security;
