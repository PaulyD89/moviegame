-- Daily Instagram post: one post per puzzle, and a place to keep the refreshed access token.
alter table daily_puzzles add column if not exists instagram_posted_at timestamptz;

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
