-- Short join codes (e.g. HXQ7P) so players can join from the installed app.
alter table public.challenges add column code text unique;
