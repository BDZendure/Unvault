-- ─────────────────────────────────────────────────────────────────────────────
-- Unvault — initial schema
--
-- Profiles, pieces, RLS, the `pieces` storage bucket and its policies, and
-- a trigger that creates a profile row on signup.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  is_premium boolean not null default false,
  analyses_used integer not null default 0,
  paddle_customer_id text,
  paddle_subscription_id text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── pieces ──────────────────────────────────────────────────────────────────
do $$ begin
  create type public.piece_status as enum ('pending', 'analyzed');
exception when duplicate_object then null; end $$;

create table if not exists public.pieces (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  image_path text not null,
  status public.piece_status not null default 'pending',
  analysis jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pieces_user_id_idx on public.pieces (user_id, created_at desc);

alter table public.pieces enable row level security;

drop policy if exists "pieces_select_own" on public.pieces;
create policy "pieces_select_own"
  on public.pieces for select
  using (auth.uid() = user_id);

drop policy if exists "pieces_insert_own" on public.pieces;
create policy "pieces_insert_own"
  on public.pieces for insert
  with check (auth.uid() = user_id);

drop policy if exists "pieces_update_own" on public.pieces;
create policy "pieces_update_own"
  on public.pieces for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pieces_delete_own" on public.pieces;
create policy "pieces_delete_own"
  on public.pieces for delete
  using (auth.uid() = user_id);

-- ── handle_new_user trigger ─────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── storage bucket: pieces ──────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('pieces', 'pieces', false)
on conflict (id) do nothing;

drop policy if exists "pieces_owner_insert" on storage.objects;
create policy "pieces_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'pieces'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "pieces_owner_select" on storage.objects;
create policy "pieces_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'pieces'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "pieces_owner_delete" on storage.objects;
create policy "pieces_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'pieces'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
