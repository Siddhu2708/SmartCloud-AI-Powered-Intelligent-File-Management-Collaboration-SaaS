-- ============================================================
-- Migration 002: Razorpay Payments
-- Run this in the Supabase SQL editor.
-- ============================================================

-- ── 1. Add Razorpay columns to user_subscriptions ─────────────────────────
-- (Supabase already has stripe_* columns; we add razorpay equivalents)
alter table public.user_subscriptions
  add column if not exists razorpay_customer_id    text,
  add column if not exists razorpay_subscription_id text,
  add column if not exists razorpay_plan_id         text;

-- ── 2. payments table  ─────────────────────────────────────────────────────
create table if not exists public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,

  -- Plan info at time of payment
  plan_name             text not null,                    -- 'pro' | 'business'
  amount                integer not null,                 -- amount in paise (INR smallest unit)
  currency              text not null default 'INR',

  -- Razorpay identifiers
  razorpay_order_id     text not null unique,
  razorpay_payment_id   text,                             -- filled after capture
  razorpay_signature    text,                             -- filled after verification

  -- Status
  payment_status        text not null default 'created'
                          check (payment_status in ('created','attempted','paid','failed','refunded')),
  subscription_status   text not null default 'pending'
                          check (subscription_status in ('pending','active','cancelled','expired')),

  -- Timestamps
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists payments_user_id_idx          on public.payments (user_id);
create index if not exists payments_razorpay_order_idx   on public.payments (razorpay_order_id);
create index if not exists payments_payment_status_idx   on public.payments (payment_status);

-- ── 3. RLS ─────────────────────────────────────────────────────────────────
alter table public.payments enable row level security;

-- Users can only see their own payments
create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

-- Inserts go through the backend (service role) — no direct client insert
-- If you ever allow direct insert, add: with check (auth.uid() = user_id)

-- ── 4. updated_at auto-trigger ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();
