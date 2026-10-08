-- Migration 001: Fix audit_logs table to add missing columns
-- 
-- The live database may have been created before resource_id and resource_type
-- columns were added to audit_logs. This migration adds them safely using
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS (idempotent).
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is safe to run multiple times.

-- Add resource_type if missing
alter table public.audit_logs
  add column if not exists resource_type text;

-- Add resource_id if missing
alter table public.audit_logs
  add column if not exists resource_id uuid;

-- Add metadata if missing
alter table public.audit_logs
  add column if not exists metadata jsonb;

-- Ensure index exists on user_id for fast log queries
create index if not exists audit_logs_user_id_idx
  on public.audit_logs (user_id);

-- Ensure index exists for resource lookups
create index if not exists audit_logs_resource_idx
  on public.audit_logs (resource_type, resource_id)
  where resource_id is not null;
