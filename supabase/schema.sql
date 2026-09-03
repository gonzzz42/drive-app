-- Supabase SQL editor에 붙여넣기

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '드라이버',
  home_lat double precision,
  home_lng double precision,
  hide_home_km numeric not null default 1.5,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id text primary key,
  name text not null,
  region text not null,
  tags text[] not null default '{}',
  distance_km numeric not null,
  start_name text not null,
  end_name text not null,
  start_lat double precision not null,
  start_lng double precision not null,
  end_lat double precision not null,
  end_lng double null,
  best_time text,          -- 'weekday_night' 등
  avoid_time text,
  tmap_url text,
  kakao_url text,
  polyline jsonb not null, -- [{lat,lng}, ...]
  cover_url text,
  is_official boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text references public.courses(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  distance_km numeric,
  duration_min integer,
  is_night boolean,
  weather text,
  overlap_pct numeric,
  completed boolean not null default false,
  path jsonb,              -- 기록된 GPS
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.courses enable row level security;

create policy "courses readable" on public.courses
  for select using (true);

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own trips" on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
