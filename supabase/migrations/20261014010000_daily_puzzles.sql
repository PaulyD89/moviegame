-- History of daily puzzles, so a starting movie or actor is never reused.
create table public.daily_puzzles (
  number int primary key,
  puzzle_date date not null unique,
  kind text not null check (kind in ('movie', 'person')),
  tmdb_id int not null,   -- the card shown: a movie id, or a person id on actor days
  movie_id int not null,  -- the movie the puzzle came from (same as tmdb_id on movie days)
  created_at timestamptz not null default now()
);

alter table public.daily_puzzles enable row level security;

-- Puzzle #1 was already live before this table existed.
insert into public.daily_puzzles (number, puzzle_date, kind, tmdb_id, movie_id)
values (1, '2026-10-14', 'movie', 315635, 315635);
