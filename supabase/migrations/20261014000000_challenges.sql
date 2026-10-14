-- Challenge a Friend: head-to-head games for 2–6 players.
-- All reads and writes go through the app's server (secret key), which validates
-- every move against TMDB. RLS is on with no policies, so the public key can't touch these.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  host_id uuid not null,
  card jsonb,                       -- current prompt (movie or person)
  used text[] not null default '{}',-- "movie:744", "person:500" — no repeats
  turn_seat int,                    -- seat of the player whose turn it is
  turn_started_at timestamptz,
  turn_deadline timestamptz,        -- shot clock; null when not everyone is live
  winner_id uuid,
  version int not null default 0,   -- optimistic locking for concurrent moves
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.challenge_players (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  player_id uuid not null,
  seat int not null,
  nickname text not null check (char_length(nickname) between 1 and 20),
  letters int not null default 0,
  last_seen timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (challenge_id, player_id),
  unique (challenge_id, seat)
);

create table public.challenge_moves (
  id bigint generated always as identity primary key,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  player_id uuid not null,
  prompt jsonb not null,
  guess text,
  outcome text not null check (outcome in ('correct', 'wrong', 'pass', 'timeout')),
  answer jsonb,
  created_at timestamptz not null default now()
);

create index challenge_moves_challenge_idx on public.challenge_moves (challenge_id, id);

alter table public.challenges enable row level security;
alter table public.challenge_players enable row level security;
alter table public.challenge_moves enable row level security;
