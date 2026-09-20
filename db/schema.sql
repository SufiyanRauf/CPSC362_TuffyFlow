-- Tuffy Flow schema
-- Run this once in the Supabase SQL Editor, top to bottom.
--
-- Row level security is at the bottom of the file. Tables created through the
-- SQL Editor have it switched off by default, and the anon key is public, so
-- without those policies anyone could read every row.

-- ---------------------------------------------------------------------------
-- 1. Reference tables (the campus itself). Seeded once, read by everyone.
-- ---------------------------------------------------------------------------

create table buildings (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  lat         double precision not null,
  lng         double precision not null
);

create table parking_lots (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  lat           double precision not null,
  lng           double precision not null,
  permit_type   text not null check (permit_type in ('student', 'staff', 'visitor')),
  total_spaces  integer not null check (total_spaces > 0)
);

comment on column parking_lots.total_spaces is
  'Display only. Fullness for scoring comes from lot_availability.';

-- Typical fullness by day and hour. Seeded pattern, not a live measurement, so the
-- UI has to say "typically" rather than giving a live number.
create table lot_availability (
  id                uuid primary key default gen_random_uuid(),
  lot_id            uuid not null references parking_lots(id) on delete cascade,
  day_of_week       smallint not null check (day_of_week between 0 and 6),
  hour              smallint not null check (hour between 0 and 23),
  typical_pct_full  smallint not null check (typical_pct_full between 0 and 100),

  -- Stops the seed inserting a duplicate row for the same lot and hour if we run it
  -- twice. Also gives us the index we need for the lookup.
  unique (lot_id, day_of_week, hour)
);

comment on column lot_availability.typical_pct_full is
  'Always 0 to 100, never a 0 to 1 fraction. We only use one scale.';

create table spots (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  kind         text not null check (kind in ('study', 'eat', 'charge', 'meet')),
  building_id  uuid not null references buildings(id) on delete cascade,
  noise_level  smallint not null check (noise_level between 1 and 5),
  has_outlets  boolean not null default false,
  seats        integer,
  unique (name, building_id)
);

comment on column spots.noise_level is
  '1 is silent, 5 is loud. Same scale as profiles.noise_pref so the two can be compared.';

create table clubs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  description  text,
  tags         text[] not null default '{}'
);

create table events (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid references clubs(id) on delete cascade,
  title        text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  building_id  uuid references buildings(id) on delete set null,
  lat          double precision,
  lng          double precision,
  tags         text[] not null default '{}',
  check (ends_at > starts_at),
  -- Every event needs a location one way or the other, or it cannot go on the map.
  check (building_id is not null or (lat is not null and lng is not null))
);

-- starts_at is timestamptz because an event happens once. class_meetings.start_time is
-- a bare time because a class repeats weekly. building_id is nullable for off campus
-- events, in which case use the lat and lng on this row.

create index events_starts_at_idx on events (starts_at);

-- GIN indexes make the array overlap operator (&&) fast. Tag matching is set overlap,
-- which is what Postgres arrays are good at.
create index events_tags_idx on events using gin (tags);
create index clubs_tags_idx  on clubs  using gin (tags);

-- ---------------------------------------------------------------------------
-- 2. Per student data
-- ---------------------------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  major         text,
  interests     text[] not null default '{}',
  career_goals  text[] not null default '{}',
  permit_type   text check (permit_type in ('student', 'staff', 'visitor')),
  noise_pref    smallint check (noise_pref between 1 and 5),
  created_at    timestamptz not null default now()
);

-- Supabase writes the auth.users row on signup but nothing creates the matching profiles
-- row, so this trigger does it. security definer means it runs with our permissions rather
-- than the new user's, which is also why profiles needs no insert policy.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- A class meeting MWF is three rows. Storing "MWF" in one row would be smaller but we
-- could not query it by day.
create table class_meetings (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  course_code  text not null,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  building_id  uuid not null references buildings(id) on delete cascade,
  check (end_time > start_time),
  unique (profile_id, course_code, day_of_week, start_time)
);

create index class_meetings_next_idx
  on class_meetings (profile_id, day_of_week, start_time);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
--
-- This is the whole security model, so it is worth getting right.
--
-- "using" says which existing rows can be seen or touched. "with check" says what a row
-- is allowed to look like after a write. An update policy with only "using" would let
-- someone reassign profile_id to another student.
--
-- RLS on with no policy denies everything and supabase-js returns an empty array with no
-- error, so a missing policy looks identical to an empty table.
--
-- (select auth.uid()) rather than auth.uid() so it is evaluated once per statement.
-- ---------------------------------------------------------------------------

alter table buildings         enable row level security;
alter table parking_lots      enable row level security;
alter table lot_availability  enable row level security;
alter table spots             enable row level security;
alter table clubs             enable row level security;
alter table events            enable row level security;
alter table profiles          enable row level security;
alter table class_meetings    enable row level security;

-- Reference tables: any signed in student may read, nobody may write from the browser.
-- There is no insert, update or delete policy on purpose, which denies all three.
-- "to authenticated" rather than "to anon" means a logged out visitor cannot scrape the
-- data set either.
create policy "signed in can read buildings"
  on buildings for select to authenticated using (true);

create policy "signed in can read parking lots"
  on parking_lots for select to authenticated using (true);

create policy "signed in can read lot availability"
  on lot_availability for select to authenticated using (true);

create policy "signed in can read spots"
  on spots for select to authenticated using (true);

create policy "signed in can read clubs"
  on clubs for select to authenticated using (true);

create policy "signed in can read events"
  on events for select to authenticated using (true);

-- Own profile only.
create policy "read own profile"
  on profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "update own profile"
  on profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert policy: the handle_new_user trigger creates the row.
-- No delete policy: deleting the auth user cascades to this table.

-- A class schedule is a week of someone's whereabouts, so this one matters.
create policy "read own classes"
  on class_meetings for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "insert own classes"
  on class_meetings for insert to authenticated
  with check (profile_id = (select auth.uid()));

create policy "update own classes"
  on class_meetings for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "delete own classes"
  on class_meetings for delete to authenticated
  using (profile_id = (select auth.uid()));
