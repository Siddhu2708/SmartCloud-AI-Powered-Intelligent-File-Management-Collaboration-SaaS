-- ============================================================
-- SmartCloud Database Schema
-- Supabase (PostgreSQL) with Row Level Security enabled.
--
-- This migration creates the canonical SmartCloud tables and
-- a private storage bucket. It is designed to be idempotent-ish
-- (safe to run via the Supabase SQL editor or migrations).
--
-- Tables: profiles (mirrors auth.users), folders, files,
--         shares, audit_logs
-- Storage bucket: documents (private)
-- ============================================================

-- ------------------------------------------------------------
-- Storage bucket: private documents bucket
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 5368709120)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- profiles table  (one row per auth user; syncs from auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- folders table
-- ------------------------------------------------------------
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid references public.folders (id) on delete cascade,
  name text not null,
  is_starred boolean not null default false,
  is_trashed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists folders_owner_id_idx on public.folders (owner_id);
create index if not exists folders_parent_id_idx on public.folders (parent_id);
create index if not exists folders_owner_trashed_idx on public.folders (owner_id, is_trashed);

-- ------------------------------------------------------------
-- files table
-- ------------------------------------------------------------
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  name text not null,
  storage_path text not null,
  file_type text,                      -- human friendly category e.g. "PDF", "Folder"
  mime_type text,
  file_size bigint not null default 0,
  is_starred boolean not null default false,
  is_trashed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists files_owner_id_idx on public.files (owner_id);
create index if not exists files_folder_id_idx on public.files (folder_id);
create index if not exists files_owner_trashed_idx on public.files (owner_id, is_trashed);
create index if not exists files_owner_starred_idx on public.files (owner_id, is_starred);

-- ------------------------------------------------------------
-- document_chunks table  (reserved for the future AI/RAG phase)
-- ------------------------------------------------------------
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null,
  embedding vector(1536),               -- requires pgvector extension
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_file_id_idx on public.document_chunks (file_id);

-- ------------------------------------------------------------
-- shares table
-- ------------------------------------------------------------
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  shared_with uuid not null references auth.users (id) on delete cascade,
  permission text not null default 'viewer' check (permission in ('viewer', 'editor')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shares_shared_with_idx on public.shares (shared_with);
create index if not exists shares_file_id_idx on public.shares (file_id);
create index if not exists shares_folder_id_idx on public.shares (folder_id);

-- ------------------------------------------------------------
-- audit_logs table
-- ------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,                 -- e.g. FILE_UPLOADED, FILE_DOWNLOADED ...
  resource_type text,                   -- file | folder | share
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id);

-- ============================================================
-- enable RLS on all tables
-- ============================================================
alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.files enable row level security;
alter table public.document_chunks enable row level security;
alter table public.shares enable row level security;
alter table public.audit_logs enable row level security;

-- ============================================================
-- profiles policies
-- ============================================================
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Allow system triggers to bypass RLS and create profiles for new users during auth.users insert
-- The handle_new_user() trigger needs to insert profiles during user signup, before user session exists
-- This policy allows the trigger (running with security definer) to create profiles
create policy "System can create profiles for new users"
  on public.profiles for insert 
  with check (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- convenience: keep profiles in sync with auth.users (optional; can be done
-- via the app on signup as well)

-- ============================================================
-- folders policies  (owner-managed + editor sharing access)
-- ============================================================
create policy "Owners can view their folders"
  on public.folders for select using (
    auth.uid() = owner_id
    or auth.uid() in (
      select s.shared_with from public.shares s
      where s.folder_id = folders.id
        and s.permission in ('viewer', 'editor')
        and (s.expires_at is null or s.expires_at > now())
    )
  );

create policy "Owners can create folders"
  on public.folders for insert with check (auth.uid() = owner_id);

create policy "Owners can update their folders"
  on public.folders for update using (
    auth.uid() = owner_id
    or auth.uid() in (
      select s.shared_with from public.shares s
      where s.folder_id = folders.id
        and s.permission = 'editor'
        and (s.expires_at is null or s.expires_at > now())
    )
  );

create policy "Owners can delete their folders"
  on public.folders for delete using (auth.uid() = owner_id);

-- ------------------------------------------------------------
-- folders: automatic parent rewrite for security sanity
-- ------------------------------------------------------------

-- ============================================================
-- files policies  (owner-managed + editor sharing access)
-- ============================================================
create policy "Owner and editors can view files"
  on public.files for select using (
    auth.uid() = owner_id
    or auth.uid() in (
      select s.shared_with from public.shares s
      where s.file_id = files.id
        and s.permission in ('viewer', 'editor')
        and (s.expires_at is null or s.expires_at > now())
    )
    or (
      files.folder_id is not null
      and auth.uid() in (
        select s2.shared_with from public.shares s2
        where s2.folder_id = files.folder_id
          and s2.permission in ('viewer', 'editor')
          and (s2.expires_at is null or s2.expires_at > now())
      )
    )
  );

create policy "Owners can create files"
  on public.files for insert with check (auth.uid() = owner_id);

create policy "Owner and editors can update files"
  on public.files for update using (
    auth.uid() = owner_id
    or auth.uid() in (
      select s.shared_with from public.shares s
      where s.file_id = files.id
        and s.permission = 'editor'
        and (s.expires_at is null or s.expires_at > now())
    )
    or (
      files.folder_id is not null
      and auth.uid() in (
        select s2.shared_with from public.shares s2
        where s2.folder_id = files.folder_id
          and s2.permission = 'editor'
          and (s2.expires_at is null or s2.expires_at > now())
      )
    )
  );

create policy "Owners can delete files"
  on public.files for delete using (auth.uid() = owner_id);

-- ============================================================
-- document_chunks policies
-- ============================================================
create policy "Owners can view chunks"
  on public.document_chunks for select using (auth.uid() = owner_id);

create policy "Owners can insert chunks"
  on public.document_chunks for insert with check (auth.uid() = owner_id);

create policy "Owners can delete chunks"
  on public.document_chunks for delete using (auth.uid() = owner_id);

-- ============================================================
-- shares policies
-- ============================================================
create policy "Owners and recipients can view shares"
  on public.shares for select using (
    auth.uid() = owner_id or auth.uid() = shared_with
  );

create policy "Owners can create shares"
  on public.shares for insert with check (auth.uid() = owner_id);

create policy "Owners can update shares"
  on public.shares for update using (auth.uid() = owner_id);

create policy "Owners can delete shares"
  on public.shares for delete using (auth.uid() = owner_id);

-- ============================================================
-- audit_logs policies
-- ============================================================
create policy "Users can view own audit logs"
  on public.audit_logs for select using (auth.uid() = user_id);

create policy "Users can insert audit logs"
  on public.audit_logs for insert with check (auth.uid() = user_id);

-- ============================================================
-- Storage RLS: allow users to manage their own folder on the
-- private 'documents' bucket. Storage path: documents/<user_id>/<file_id>/<name>
-- ============================================================
create policy "Users can access their own storage folder"
  on storage.objects for select
  using ( bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text );

create policy "Users can insert into their own storage folder"
  on storage.objects for insert
  with check ( bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text );

create policy "Users can update their own storage objects"
  on storage.objects for update
  using ( bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text )
  with check ( bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text );

create policy "Users can delete their own storage objects"
  on storage.objects for delete
  using ( bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text );

-- ============================================================
-- helper: register a user profile on signup (run from backend or RPC)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Create profile
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  )
  on conflict (id) do nothing;
  
  -- Create subscription (consolidated into single trigger to avoid race conditions)
  insert into public.user_subscriptions (user_id, plan, storage_limit_bytes, ai_request_quota)
  values (
    new.id,
    'free',
    15 * 1024 * 1024 * 1024,  -- 15 GB
    0                         -- unlimited for free tier (rate-limited on backend)
  )
  on conflict (user_id) do nothing;
  
  return new;
end;
$$;

-- trigger on auth.users to auto-create profile and subscription
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_subscription_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- user_subscriptions table  (plan tracking and billing state)
-- ============================================================
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  storage_limit_bytes bigint not null default 16106127360,  -- 15 GB for free
  ai_request_quota integer not null default 0,              -- 0 = unlimited for paid plans
  ai_requests_used integer not null default 0,
  billing_cycle_start timestamptz,
  billing_cycle_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  auto_renew boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_subscriptions_user_id_idx on public.user_subscriptions (user_id);

-- ============================================================
-- user_subscriptions policies
-- ============================================================
alter table public.user_subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.user_subscriptions for select using (auth.uid() = user_id);

create policy "System can create subscriptions for new users"
  on public.user_subscriptions for insert with check (true);

create policy "Users can update own subscription"
  on public.user_subscriptions for update using (auth.uid() = user_id);

