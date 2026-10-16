-- Wrong daily guesses (VS ones are already in challenge_moves), to spot answers the matcher should accept.
create table if not exists missed_guesses (
  id bigserial primary key,
  at timestamptz not null default now(),
  puzzle_number int not null,
  card jsonb not null,
  guess text not null
);
create index if not exists missed_guesses_at on missed_guesses (at desc);
alter table missed_guesses enable row level security;
