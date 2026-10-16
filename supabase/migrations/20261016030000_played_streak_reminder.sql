-- The streak now counts days played in a row (finished, won or lost), not wins in a row.
create or replace function public.streak_reminder_targets(today integer)
 returns table(endpoint text, p256dh text, auth text, streak bigint)
 language sql
 stable
as $function$
  with played as (
    select player_id, puzzle_number,
           puzzle_number - row_number() over (partition by player_id order by puzzle_number) as grp
    from public.daily_plays
    where finished_at is not null and puzzle_number < today
  ),
  streaks as (
    select player_id, count(*) as n, max(puzzle_number) as last
    from played group by player_id, grp
  )
  select s.endpoint, s.p256dh, s.auth, st.n
  from public.push_subscriptions s
  join streaks st on st.player_id = s.player_id and st.last = today - 1
  where s.daily
    and not exists (
      select 1 from public.daily_plays d
      where d.player_id = s.player_id and d.puzzle_number = today and d.finished_at is not null
    );
$function$;
