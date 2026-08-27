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

create policy "profile owner only" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
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
