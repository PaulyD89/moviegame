-- Web push: one row per device that turned notifications on.
create table public.push_subscriptions (
  endpoint text primary key,
  player_id uuid,                     -- same anonymous id as challenge players (mh_pid cookie)
  p256dh text not null,
  auth text not null,
  daily boolean not null default false, -- wants the nightly "new Movie Chain" reminder
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_player_idx on public.push_subscriptions (player_id);
create index push_subscriptions_daily_idx on public.push_subscriptions (daily) where daily;

alter table public.push_subscriptions enable row level security;

-- So the nightly reminder goes out once per puzzle even if the cron fires twice.
alter table public.daily_puzzles add column reminded_at timestamptz;
