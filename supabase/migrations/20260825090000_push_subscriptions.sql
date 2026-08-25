create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id, updated_at desc);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push subscriptions read own" on public.push_subscriptions;
drop policy if exists "push subscriptions insert own" on public.push_subscriptions;
drop policy if exists "push subscriptions update own" on public.push_subscriptions;
drop policy if exists "push subscriptions delete own" on public.push_subscriptions;

create policy "push subscriptions read own" on public.push_subscriptions
for select using (user_id = auth.uid());

create policy "push subscriptions insert own" on public.push_subscriptions
for insert with check (user_id = auth.uid());

create policy "push subscriptions update own" on public.push_subscriptions
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push subscriptions delete own" on public.push_subscriptions
for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;
