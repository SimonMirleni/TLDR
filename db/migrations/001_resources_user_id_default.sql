alter table public.resources
  alter column user_id set default auth.uid();
