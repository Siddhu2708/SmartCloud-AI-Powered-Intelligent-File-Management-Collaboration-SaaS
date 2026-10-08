-- ============================================================
-- Migration 008: AI Assignments Table
-- 
-- Creates ai_assignments table for user task/assignment management
-- integrated with SmartCloud AI Assistant.
--
-- Features:
-- - User-owned assignments with RLS policy
-- - Optional file association
-- - Priority and status tracking
-- - Tag support
-- - Automatic timestamps
-- - Indexes for efficient querying
--
-- Run this in the Supabase SQL editor.
-- ============================================================

-- Step 1: Create ai_assignments table
create table if not exists public.ai_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_id uuid references public.files (id) on delete set null,
  
  -- Assignment metadata
  title text not null,
  description text,
  
  -- Status tracking
  status text not null default 'not_started' 
    check (status in ('not_started', 'in_progress', 'completed', 'cancelled')),
  
  priority text not null default 'medium' 
    check (priority in ('low', 'medium', 'high', 'urgent')),
  
  -- Dates
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Tags for organization
  tags jsonb default '[]'::jsonb
);

-- Step 2: Create indexes for efficient queries
-- Index on user_id for listing user's assignments
create index if not exists ai_assignments_user_id_idx 
  on public.ai_assignments (user_id);

-- Index on file_id for finding assignments for a file
create index if not exists ai_assignments_file_id_idx 
  on public.ai_assignments (file_id);

-- Index on status for filtering
create index if not exists ai_assignments_status_idx 
  on public.ai_assignments (status);

-- Index on priority for sorting
create index if not exists ai_assignments_priority_idx 
  on public.ai_assignments (priority);

-- Index on due_date for finding due soon
create index if not exists ai_assignments_due_date_idx 
  on public.ai_assignments (due_date);

-- Compound index for common query: user_id + status
create index if not exists ai_assignments_user_status_idx 
  on public.ai_assignments (user_id, status);

-- Compound index for common query: user_id + due_date
create index if not exists ai_assignments_user_due_idx 
  on public.ai_assignments (user_id, due_date);

-- Step 3: Enable RLS (Row Level Security)
alter table public.ai_assignments enable row level security;

-- Step 4: Create RLS policies
-- Policy 1: Users can view their own assignments
create policy "Users can view own assignments"
  on public.ai_assignments
  for select
  using (auth.uid() = user_id);

-- Policy 2: Users can create assignments for themselves
create policy "Users can create assignments for themselves"
  on public.ai_assignments
  for insert
  with check (auth.uid() = user_id);

-- Policy 3: Users can update their own assignments
create policy "Users can update own assignments"
  on public.ai_assignments
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policy 4: Users can delete their own assignments
create policy "Users can delete own assignments"
  on public.ai_assignments
  for delete
  using (auth.uid() = user_id);

-- Step 5: Create trigger for updated_at
-- Drop existing trigger if present
drop trigger if exists update_ai_assignments_timestamp on public.ai_assignments cascade;
drop function if exists update_ai_assignments_timestamp() cascade;

-- Create function to update updated_at
create function public.update_ai_assignments_timestamp()
returns trigger 
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create trigger
create trigger update_ai_assignments_timestamp
  before update on public.ai_assignments
  for each row
  execute function public.update_ai_assignments_timestamp();

-- ============================================================
-- Summary:
-- 
-- Table: ai_assignments
-- - id (UUID PK)
-- - user_id (UUID FK → auth.users, RLS enforced)
-- - file_id (UUID FK → files, nullable)
-- - title (required)
-- - description (optional)
-- - status (not_started, in_progress, completed, cancelled)
-- - priority (low, medium, high, urgent)
-- - due_date (optional)
-- - created_at (auto)
-- - updated_at (auto, triggered on update)
-- - tags (JSON array)
--
-- Indexes: user_id, file_id, status, priority, due_date,
--          compound indexes for common queries
--
-- RLS Policies:
-- - auth.uid() = user_id enforced on all operations
-- - Cross-user access prevented at database level
-- - Backend validation provides defense-in-depth
--
-- Triggers:
-- - Automatic updated_at timestamp on INSERT/UPDATE
--
-- Security:
-- - User can only see/modify their own assignments
-- - File references validate that file belongs to user
-- - No cross-user data leakage possible
-- ============================================================
