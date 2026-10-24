-- Tuffy Flow schema
-- Run this once in the Supabase SQL Editor, top to bottom.
--
-- Row level security is the whole security model here. Tables created through
-- the SQL Editor have it switched off by default, and the key the browser
-- ships with is public, so a table without it is readable and writable by
-- anybody who opens the site.
--
-- That is why every table switches it on in the line directly below its own
-- create, rather than in one block at the end as this file used to do. Run
-- only the first half of a file like that and you get eight working tables
-- with no security on any of them, and nothing to show for it: the app looks
-- completely normal, because every query succeeds. The check at the very
-- bottom is there to say so out loud if any of it did not run.

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
alter table buildings enable row level security;

create table parking_lots (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  lat           double precision not null,
  lng           double precision not null,
  -- An array because a lot can take more than one. The structures take
  -- student, employee and hourly permits at the same time.
  permits       text[] not null check (
                  cardinality(permits) > 0
                  and permits <@ array['student', 'employee', 'resident', 'visitor']
                ),
  -- Nullable: CSUF only publishes a capacity for the facilities on its live
  -- counts board, and a made up number is worse than no number.
  total_spaces  integer check (total_spaces > 0)
);
alter table parking_lots enable row level security;

comment on column parking_lots.permits is
  'Which permit types may park here. CSUF renamed every lot in summer 2025: E is employee, S is student, R is resident, and visitors buy an hourly permit.';

comment on column parking_lots.total_spaces is
  'Display only, and null where CSUF publishes no figure. Fullness for scoring comes from lot_availability.';

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
alter table lot_availability enable row level security;

comment on column lot_availability.typical_pct_full is
  'Always 0 to 100, never a 0 to 1 fraction. We only use one scale.';

create table spots (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          text not null check (kind in ('study', 'eat', 'charge', 'meet')),
  building_id   uuid not null references buildings(id) on delete cascade,
  floor         smallint,
  section       text check (section in ('North', 'South')),
  noise_level   smallint not null check (noise_level between 1 and 5),
  has_outlets   boolean not null default false,
  is_indoor     boolean not null default true,
  seats         integer,
  reservable    boolean not null default false,
  opens_at      time,
  closes_at     time,
  hours_note    text,
  source_url    text,
  unique (name, building_id)
);
alter table spots enable row level security;

comment on column spots.floor is
  'Pollak Library is one building but eight places to work with different rules,
   six library floors plus the group study rooms and the Student Genius Center,
   so floor and section are what make them separate rows.';

comment on column spots.opens_at is
  'Where we have published hours. Null means we do not know, not open all day.
   hours_note carries the published hours in full, condensed into one line, and
   sometimes a sentence of ours about the place.';

comment on column spots.noise_level is
  '1 is silent, 5 is loud. Same scale as profiles.noise_pref so the two can be compared.';

create table clubs (
  id            uuid primary key default gen_random_uuid(),
  titanlink_id  text unique,
  name          text not null unique,
  summary       text,
  description   text,
  website_key   text,
  status        text,
  categories    text[] not null default '{}',
  tags          text[] not null default '{}',
  -- "not null" stops the column being null, not the array holding a null
  -- element. A null in here reaches the clubs screen as a tag with no name,
  -- which filters to nothing and cannot be cleared.
  check (array_position(categories, null) is null),
  check (array_position(tags, null) is null)
);
alter table clubs enable row level security;

comment on column clubs.categories is
  'TitanLink CategoryNames, verbatim. Theirs.';

comment on column clubs.tags is
  'Our own matching vocabulary. Ours, not a TitanLink field. The mapping lives
   in db/seed_clubs.sql.';

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
  -- Same trap as on clubs, and worse here: these go to the scoring service,
  -- which types them as a list of strings and rejects the whole request over
  -- one null, taking out the dashboard, parking, events and the rail at once.
  check (array_position(tags, null) is null),
  check (ends_at > starts_at),
  -- Every event needs a location one way or the other, or it cannot go on the map.
  check (building_id is not null or (lat is not null and lng is not null))
);
alter table events enable row level security;

-- starts_at is timestamptz because an event happens once. class_meetings.start_time is
-- a bare time because a class repeats weekly. building_id is nullable for off campus
-- events, in which case use the lat and lng on this row.

create index events_starts_at_idx on events (starts_at);

-- GIN indexes make the array overlap operator (&&) fast. Tag matching is set overlap,
-- which is what Postgres arrays are good at.
create index events_tags_idx on events using gin (tags);
create index clubs_tags_idx  on clubs  using gin (tags);
create index clubs_categories_idx on clubs using gin (categories);

-- ---------------------------------------------------------------------------
-- 2. Per student data
-- ---------------------------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  major         text,
  interests     text[] not null default '{}',
  career_goals  text[] not null default '{}',
  permit_type   text check (permit_type in ('student', 'employee', 'resident', 'visitor')),
  noise_pref    smallint check (noise_pref between 1 and 5),
  created_at    timestamptz not null default now()
);
alter table profiles enable row level security;

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
alter table class_meetings enable row level security;

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

-- ---------------------------------------------------------------------------
-- 4. Did all of that actually run?
--
-- The expensive mistake with this file is running part of it. Every query
-- still works afterwards, so nothing on the screen looks wrong, and the one
-- guard the app has looks for an empty table, which is the opposite symptom.
-- This is the only thing that will tell you.
-- ---------------------------------------------------------------------------

do $$
-- Only this file's own eight tables, by name. Checking everything in the
-- schema would mean a project that happens to hold a table from somewhere
-- else fails here, and the message would blame security for something else
-- entirely. The same goes for counting policies: it counts the ones on these
-- eight, so adding a policy elsewhere later does not break this file.
declare
  ours text[] := array[
    'buildings', 'parking_lots', 'lot_availability', 'spots',
    'clubs', 'events', 'profiles', 'class_meetings'
  ];
  missing text;
  unprotected text;
  policy_count int;
begin
  select string_agg(name, ', ' order by name) into missing
  from unnest(ours) as name
  where to_regclass('public.' || name) is null;

  if missing is not null then
    raise exception 'These tables were never created: %. Section 1 or 2 did not finish.', missing;
  end if;

  select string_agg(c.relname, ', ' order by c.relname) into unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any (ours)
    and not c.relrowsecurity;

  if unprotected is not null then
    raise exception
      'Row level security is off on: %. Anyone with the public key can read and write these.',
      unprotected;
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public' and tablename = any (ours);

  if policy_count <> 12 then
    raise exception 'Expected 12 policies, found %. Section 3 did not finish.', policy_count;
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal
  ) then
    raise exception 'The on_auth_user_created trigger is missing, so signing up will not create a profile.';
  end if;

  raise notice 'Schema check passed: 8 tables protected, 12 policies, signup trigger present.';
end $$;
