-- Friends who open the link after a game started: they watch, and get seated in the rematch.
create table public.challenge_waitlist (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  player_id uuid not null,
  nickname text not null check (char_length(nickname) between 1 and 20),
  joined_at timestamptz not null default now(),
  primary key (challenge_id, player_id)
);
alter table public.challenge_waitlist enable row level security;
