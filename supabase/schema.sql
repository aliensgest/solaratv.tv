-- =============================================
-- SOLARA TV — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================

-- 1) PROFILES (extends auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  email       text,
  role        text default 'client' check (role in ('client','admin','reseller')),
  created_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, username, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
          coalesce(new.raw_user_meta_data->>'role', 'client'));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) SUBSCRIPTIONS
create table if not exists public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  type         text not null check (type in ('m3u','mag','protocol')),
  action       text not null check (action in ('new','renew')),
  username     text,
  password     text,
  mac          text,
  package_id   int,
  bouquet_ids  text,
  status       text default 'pending' check (status in ('pending','success','failed')),
  note         text,
  api_response jsonb,
  created_at   timestamptz default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id);
create index if not exists subscriptions_created_idx on public.subscriptions(created_at desc);

-- 3) BLOG POSTS
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  excerpt     text,
  content     text,
  cover_image text,
  author_id   uuid references public.profiles(id) on delete set null,
  published   boolean default false,
  tags        text[],
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists posts_published_idx on public.posts(published, created_at desc);

-- 4) PAGE VIEWS (analytics)
create table if not exists public.page_views (
  id         bigserial primary key,
  page       text not null,
  referrer   text,
  country    text,
  viewed_at  timestamptz default now()
);
create index if not exists page_views_viewed_idx on public.page_views(viewed_at desc);
create index if not exists page_views_page_idx on public.page_views(page);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table public.profiles      enable row level security;
alter table public.subscriptions enable row level security;
alter table public.posts         enable row level security;
alter table public.page_views    enable row level security;

-- Profiles: user reads own, admin reads all
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

-- Subscriptions: user sees own, admin sees all, admin writes
create policy "subs_user_read" on public.subscriptions
  for select using (auth.uid() = user_id or exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin','reseller')));

create policy "subs_admin_write" on public.subscriptions
  for insert with check (exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin','reseller')));

create policy "subs_admin_update" on public.subscriptions
  for update using (exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin','reseller')));

-- Posts: anyone reads published, admin writes
create policy "posts_public_read" on public.posts
  for select using (published = true or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "posts_admin_write" on public.posts
  for all using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Page views: anyone can insert (anonymous analytics), only admin reads
create policy "views_anon_insert" on public.page_views
  for insert with check (true);

create policy "views_admin_read" on public.page_views
  for select using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'));
