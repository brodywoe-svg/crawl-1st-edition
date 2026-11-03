-- Phase 2: characters saved to your account (dev/planning/supabase-database.md).
-- One row per Character Creator character. data is the whole character, the same shape as localStorage "crawl-characters".

create table public.characters (
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- the Creator's own id (pc_…), so this device's copy and the cloud copy match up. Unique per owner, not globally,
  -- so one person's ids can never clash with another's.
  id text not null check (char_length(id) between 1 and 64),
  name text not null default '' check (char_length(name) <= 200),
  data jsonb not null check (octet_length(data::text) < 1000000), -- portraits are data URLs inside data for now
  edited_at timestamptz not null default now(), -- from the character's "edited"; the newer copy wins when syncing
  created_at timestamptz not null default now(),
  primary key (owner_id, id)
);
comment on table public.characters is 'Character Creator characters. Owners can do anything with their own; admins can read all (support).';

alter table public.characters enable row level security;

create policy "Read your own characters, or any as an admin" on public.characters
  for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
create policy "Add your own characters" on public.characters
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Change your own characters" on public.characters
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Delete your own characters" on public.characters
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.characters from anon, authenticated;
grant select, insert, update, delete on public.characters to authenticated;
