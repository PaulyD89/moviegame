-- Errors you've seen can be dismissed from the admin banner; they stay in the log.
alter table public.app_errors add column dismissed_at timestamptz;
create index app_errors_open_idx on public.app_errors (at desc) where dismissed_at is null;
