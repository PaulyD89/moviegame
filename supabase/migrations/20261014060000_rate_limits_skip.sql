-- Rate limits: fixed-window hit counters, keyed like "guess:pid:<uuid>" or "create:ip:1.2.3.4".
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;

-- Count one hit and say whether it's still within the limit. Old windows are swept now and then.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into rate_limits as r (key, window_start) values (p_key, ws)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return n <= p_max;
end;
$$;

revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;

-- A turn nobody takes for a day is skipped (with a letter) so games can't stall forever.
alter table public.challenge_moves drop constraint challenge_moves_outcome_check;
alter table public.challenge_moves
  add constraint challenge_moves_outcome_check check (outcome in ('correct', 'wrong', 'pass', 'timeout', 'skip'));

create index challenges_stalled_idx on public.challenges (turn_started_at)
  where status = 'playing' and turn_deadline is null;
