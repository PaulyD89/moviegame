-- Country (from Vercel's geo header) for each daily game, for the admin "where players are from" panel.
alter table daily_plays add column if not exists country text;

create or replace function public.admin_countries(days integer)
 returns table(country text, players bigint)
 language sql
 stable
as $function$
  select coalesce(country, '??') as country, count(distinct player_id) as players
  from public.daily_plays
  where started_at > now() - make_interval(days => days)
    and country is not null
  group by 1
  order by 2 desc;
$function$;
