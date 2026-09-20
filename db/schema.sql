-- Tuffy Flow schema
-- Run this once in the Supabase SQL Editor, top to bottom.
--
-- Read every section before you run it. You will be asked to explain this file, and the
-- security half of it is the part that actually matters.
--
-- One thing to know before you start: tables you create in the SQL Editor have Row Level
-- Security OFF by default, and Supabase does not warn you. Row Level Security is the only
-- thing standing between a visitor and your data, because the key your app ships to the
-- browser is public by design. The policies at the bottom of this file are not optional
-- polish. Without them, anyone who opens your site can read every student's name, major,
-- and full weekly class schedule from the browser console. Your app looks and behaves
-- exactly the same either way, which is what makes it dangerous.

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

comment on column buildings.lat is
  'Use double precision, not real and not text. Coordinates need the precision.';

create table parking_lots (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  lat           double precision not null,
  lng           double precision not null,
  permit_type   text not null check (permit_type in ('student', 'staff', 'visitor')),
  total_spaces  integer not null check (total_spaces > 0)
);

comment on column parking_lots.permit_type is
  'A simplification. Real lots accept several permit types, and some open to anyone after
   5pm. One permit per lot is fine for seeded data, but say so when you present it.';

comment on column parking_lots.total_spaces is
  'Display only. Do not use this in scoring. Fullness comes from lot_availability.';

-- Typical fullness by day and hour. This is a seeded pattern, not a live measurement.
-- Anywhere this reaches the screen it must be worded as "typically" or "usually".
create table lot_availability (
  id                uuid primary key default gen_random_uuid(),
  lot_id            uuid not null references parking_lots(id) on delete cascade,
  day_of_week       smallint not null check (day_of_week between 0 and 6),
  hour              smallint not null check (hour between 0 and 23),
  typical_pct_full  smallint not null check (typical_pct_full between 0 and 100),

  -- Not optional. Without this, re-running the seed inserts a second row for the same
  -- lot and hour, your scoring join returns two rows per lot, and the ranking silently
  -- double counts. It also gives you the index you need for free, and it lets the seed
  -- use "on conflict do update" so it can be run twice safely.
  unique (lot_id, day_of_week, hour)
);

comment on column lot_availability.typical_pct_full is
  'Always 0 to 100, never a 0 to 1 fraction. Pick one and never mix them. Three people
   writing seed data with two different scales produces numbers that look plausible and
   rank nonsense.';

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
  '1 is silent, 5 is loud. Shares a scale with profiles.noise_pref on purpose, which makes
   the match a one line calculation: 1 - abs(noise_level - noise_pref) / 4.';

comment on table spots is
  'No lat and lng here. A spot is inside a building, so the building has the coordinates.
   Storing them twice gives you two sources of truth that drift apart.';

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

comment on column events.starts_at is
  'timestamptz, because an event happens once at a real moment in time. Compare this with
   class_meetings.start_time, which is a bare time because a class repeats every week.
   That difference is worth understanding before you write any time handling.';

comment on column events.building_id is
  'Nullable, because some events are off campus. One rule, one code path: if building_id is
   set, use the building coordinates. Otherwise use lat and lng on this row.';

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

comment on column profiles.major is
  'Plain text with no separate majors table. That is a deliberate choice, not an oversight.
   Nothing in this app looks a major up or joins on it.';

comment on column profiles.permit_type is
  'The parking recommender filters lots against this. Without it there is nothing to match
   a permit against.';

-- Signing up writes a row into auth.users, which is Supabase internal. Nothing creates the
-- matching profiles row unless you do it here. Skip this and every new account lands on a
-- dashboard with no name and no schedule, and no error anywhere to tell you why.
--
-- "security definer" means the function runs with the permissions of whoever created it
-- rather than whoever triggered it, so it can write the row before the new user has any
-- permissions of their own. It also means profiles needs no insert policy at all.
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

-- A class that meets Monday, Wednesday and Friday is THREE ROWS, not one row with "MWF"
-- in it. Storing "MWF" as text feels tidier and then you cannot query it.
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

comment on column class_meetings.start_time is
  'A bare time, deliberately. This is a weekly repeating pattern, so it has no date and no
   timezone of its own. Campus local time is the only time this is ever read in.';

create index class_meetings_next_idx
  on class_meetings (profile_id, day_of_week, start_time);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
--
-- Read this section twice. It is the whole security model.
--
-- Two rules that are easy to get wrong:
--
--   "using" controls which existing rows you can see or touch. "with check" controls what
--   a row is allowed to look like after you write it. An update policy with only "using"
--   lets someone change profile_id to another student's id and hand their row away.
--
--   Turning RLS on with no policy denies everything, silently. supabase-js returns an
--   empty array and no error, so a missing policy looks exactly like an empty table. If a
--   list renders blank and nothing errored, suspect a missing policy before you suspect
--   your code.
--
-- Policies are written as (select auth.uid()) rather than auth.uid() so Postgres evaluates
-- it once per statement instead of once per row.
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

-- Your own profile, and only your own.
create policy "read own profile"
  on profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "update own profile"
  on profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert policy: the handle_new_user trigger creates the row.
-- No delete policy: deleting the auth user cascades to this table.

-- Your class schedule is your whereabouts for every day of the week. Treat it that way.
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
