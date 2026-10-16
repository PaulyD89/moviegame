-- Where each daily player arrived from (ad, search, social, direct), for the admin "Top sources" panel.
alter table daily_plays add column if not exists source text;

create or replace function public.admin_sources(days integer)
 returns table(source text, players bigint, moved bigint, finished bigint)
 language sql
 stable
as $function$
  select coalesce(source, 'Unknown') as source,
         count(distinct player_id) as players,
         count(distinct player_id) filter (where moves > 0) as moved,
         count(distinct player_id) filter (where finished_at is not null) as finished
  from public.daily_plays
  where started_at > now() - make_interval(days => days)
    and source is not null
  group by 1
  order by 2 desc;
$function$;
