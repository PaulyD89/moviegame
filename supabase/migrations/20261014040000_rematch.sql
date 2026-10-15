-- Points a finished game at its rematch, so every player lands in the same new game.
alter table public.challenges add column rematch_id uuid references public.challenges (id) on delete set null;
