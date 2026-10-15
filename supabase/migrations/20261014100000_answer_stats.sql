-- How everyone answered each card in today's daily, for "how you compare" on the results screen.
create or replace function public.daily_answer_stats(p_puzzle int, p_prompts text[])
returns table (prompt text, answer text, answer_name text, n bigint)
language sql
stable
as $$
  select (l->'card'->>'kind') || ':' || (l->'card'->>'id'),
         (l->'answer'->>'kind') || ':' || (l->'answer'->>'id'),
         min(l->'answer'->>'name'),
         count(*)
  from public.daily_plays d, jsonb_array_elements(d.state->'links') l
  where d.puzzle_number = p_puzzle
    and d.state is not null
    and (l->'card'->>'kind') || ':' || (l->'card'->>'id') = any(p_prompts)
  group by 1, 2;
$$;
revoke execute on function public.daily_answer_stats(int, text[]) from public, anon, authenticated;
