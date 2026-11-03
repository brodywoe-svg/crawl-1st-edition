-- Accounts: one profile per Supabase user. See dev/planning/supabase-admin-login.md.
-- Today only admins have accounts (sign-ups are off). Player accounts will use this same table with role 'player',
-- so nothing here needs to change when they arrive.

create type public.crawl_role as enum ('player', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- shown next to everything an admin edits ("Update items from the admin page (by Brody Woelke)")
  display_name text not null default '' check (char_length(display_name) <= 40),
  role public.crawl_role not null default 'player',
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per account. role is changed only from the dashboard (SQL editor), never from the site.';

alter table public.profiles enable row level security;

-- Is the signed-in user an admin? security definer, so the policies below can use it without checking themselves.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
$$;

create policy "Read your own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Admins read every profile" on public.profiles
  for select to authenticated using (public.is_admin());
create policy "Update your own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- From the site you can change only your display name. Rows are made by the trigger below, and role is set in the dashboard.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- A profile for every new account. The name comes from the invite or sign-up data, or else the part of the email before the @.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 40));
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
