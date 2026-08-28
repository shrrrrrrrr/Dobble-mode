create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '我',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  platform text not null check (platform in ('抖音', '小红书', 'B站', '视频号')),
  published_at date not null,
  cover_path text,
  plays integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  favorites integer not null default 0,
  shares integer not null default 0,
  note text not null default '',
  mood text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id uuid not null references public.works(id) on delete cascade,
  type text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  image_path text,
  image_caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.works enable row level security;
alter table public.feedback_events enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;

drop policy if exists "profile owner only" on public.profiles;
drop policy if exists "profiles readable by everyone" on public.profiles;
drop policy if exists "profiles insertable by owner" on public.profiles;
drop policy if exists "profiles editable by owner" on public.profiles;
drop policy if exists "work owner only" on public.works;
drop policy if exists "feedback owner only" on public.feedback_events;
drop policy if exists "posts readable by everyone" on public.community_posts;
drop policy if exists "posts writable by owner" on public.community_posts;
drop policy if exists "posts editable by owner" on public.community_posts;
drop policy if exists "posts deletable by owner" on public.community_posts;
drop policy if exists "comments readable by everyone" on public.community_comments;
drop policy if exists "comments writable by owner" on public.community_comments;
drop policy if exists "likes readable by everyone" on public.community_likes;
drop policy if exists "likes writable by owner" on public.community_likes;

create policy "profiles readable by everyone" on public.profiles for select using (true);
create policy "profiles insertable by owner" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles editable by owner" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "work owner only" on public.works for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "feedback owner only" on public.feedback_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "posts readable by everyone" on public.community_posts for select using (true);
create policy "posts writable by owner" on public.community_posts for insert with check (auth.uid() = user_id);
create policy "posts editable by owner" on public.community_posts for update using (auth.uid() = user_id);
create policy "posts deletable by owner" on public.community_posts for delete using (auth.uid() = user_id);
create policy "comments readable by everyone" on public.community_comments for select using (true);
create policy "comments writable by owner" on public.community_comments for insert with check (auth.uid() = user_id);
create policy "likes readable by everyone" on public.community_likes for select using (true);
create policy "likes writable by owner" on public.community_likes for insert with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nickname', '我'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('creator-media', 'creator-media', false)
on conflict (id) do update set public = false;

drop policy if exists "creator media readable by owner" on storage.objects;
drop policy if exists "creator media insertable by owner" on storage.objects;
drop policy if exists "creator media editable by owner" on storage.objects;
drop policy if exists "creator media deletable by owner" on storage.objects;

create policy "creator media readable by owner"
  on storage.objects for select to authenticated
  using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "creator media insertable by owner"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'creator-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "creator media editable by owner"
  on storage.objects for update to authenticated
  using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'creator-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "creator media deletable by owner"
  on storage.objects for delete to authenticated
  using (bucket_id = 'creator-media' and (storage.foldername(name))[1] = (select auth.uid()::text));
