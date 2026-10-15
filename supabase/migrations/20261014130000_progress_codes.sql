-- Save / restore progress: one permanent code per player, plus a backup of the phone's stats.
create table public.progress_codes (
  player_id uuid primary key,
  code text not null unique,
  snapshot jsonb,                 -- the phone's stats, challenge list, nickname (refreshed after games)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.progress_codes enable row level security;

-- Restoring on a phone that already played: move that phone's history onto the restored
-- player, except where both played the same daily or are in the same game (the saved one wins).
create or replace function public.merge_players(p_from uuid, p_to uuid)
returns void
language plpgsql
as $$
begin
  if p_from = p_to then return; end if;

  update daily_plays set player_id = p_to
  where player_id = p_from
    and puzzle_number not in (select puzzle_number from daily_plays where player_id = p_to);
  delete from daily_plays where player_id = p_from;

  update challenges c set host_id = p_to
  where host_id = p_from
    and not exists (select 1 from challenge_players p where p.challenge_id = c.id and p.player_id = p_to);
  update challenges c set winner_id = p_to
  where winner_id = p_from
    and not exists (select 1 from challenge_players p where p.challenge_id = c.id and p.player_id = p_to);
  update challenge_players set player_id = p_to
  where player_id = p_from
    and challenge_id not in (select challenge_id from challenge_players where player_id = p_to);
  update challenge_moves m set player_id = p_to
  where player_id = p_from
    and exists (select 1 from challenge_players p where p.challenge_id = m.challenge_id and p.player_id = p_to);
  update challenge_waitlist set player_id = p_to
  where player_id = p_from
    and challenge_id not in (select challenge_id from challenge_waitlist where player_id = p_to);

  update push_subscriptions set player_id = p_to where player_id = p_from;
  delete from progress_codes where player_id = p_from;
end;
$$;
revoke execute on function public.merge_players(uuid, uuid) from public, anon, authenticated;
