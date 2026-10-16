-- Names earned with a 7-day streak: unique across players, shown with a gold check in VS games.
create table if not exists claimed_names (
  player_id uuid primary key,
  name text not null,
  name_key text not null unique,
  claimed_at timestamptz not null default now()
);
alter table claimed_names enable row level security;

CREATE OR REPLACE FUNCTION public.merge_players(p_from uuid, p_to uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
  -- A claimed name follows the player, unless the account they're restoring into already has one.
  update claimed_names set player_id = p_to
  where player_id = p_from and not exists (select 1 from claimed_names where player_id = p_to);
  delete from claimed_names where player_id = p_from;
  delete from progress_codes where player_id = p_from;
end;
$function$;
