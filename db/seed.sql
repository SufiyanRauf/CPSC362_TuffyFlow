-- Tuffy Flow seed data
-- Run after schema.sql. Safe to run more than once.
--
-- Coordinates come from CSUF's own campus map data, fullerton.edu/campusmap/locations.json,
-- retrieved 1 October 2026. Not estimates. Campus is 800 N. State College Blvd.

-- ---------------------------------------------------------------------------
-- Buildings
-- ---------------------------------------------------------------------------
insert into buildings (name, code, lat, lng) values
  ('McCarthy Hall',                      'MH',   33.879706, -117.885573),
  ('Langsdorf Hall',                     'LH',   33.879057, -117.884333),
  ('Pollak Library',                     'PL',   33.881414, -117.885361),
  ('Titan Student Union',                'TSU',  33.881795, -117.888204),
  ('Computer Science',                   'CS',   33.882349, -117.88275),
  ('Engineering',                        'E',    33.882349, -117.88329),
  ('Dan Black Hall',                     'DBH',  33.879305, -117.885845),
  ('Humanities',                         'H',    33.88051, -117.884151),
  ('Education Classroom',                'EC',   33.881386, -117.884348),
  ('Gordon Hall',                        'GH',   33.879666, -117.884138),
  ('Steven G. Mihaylo Hall',             'SGMH', 33.878837, -117.883428),
  ('Titan Gym',                          'TG',   33.883132, -117.886251),
  ('Student Recreation Center',          'SRC',  33.883147, -117.887846),
  ('Visual Arts',                        'VA',   33.880722, -117.888976),
  ('Kinesiology and Health Science',     'KHS',  33.882697, -117.886076)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Parking lots
-- ---------------------------------------------------------------------------
insert into parking_lots (name, lat, lng, permit_type, total_spaces) values
  -- The five counted structures, names and totals taken from the campus parking
  -- availability board. Coordinates still approximate.
  ('Nutwood Structure',              33.879029, -117.88852, 'student', 2484),
  ('State College Structure',        33.883055, -117.888671, 'student', 1373),
  ('Eastside North',                 33.880356, -117.881687, 'student', 1880),
  ('Eastside South',                 33.881079, -117.881804, 'student', 1341),
  ('S8 and S10',                     33.8862, -117.8848, 'student', 2104),
  -- Surface lots, not on the counts board
  ('Lot A',                          33.887246, -117.888922, 'student',  420),
  ('Lot C',                          33.878331, -117.88835, 'student',  380),
  ('Lot D',                          33.884152, -117.887855, 'student',  310),
  ('Lot E',                          33.88188, -117.881648, 'student',  260),
  ('Lot G',                          33.888301, -117.886538, 'student',  340),
  ('Staff Lot J',                    33.88344, -117.882967, 'staff',    180),
  ('Visitor Lot',                    33.8800, -117.8895, 'visitor',  120)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Typical fullness, every lot, every day, 6am to 9pm.
-- Generated rather than typing 1,344 rows. Weekdays peak late morning, weekends
-- stay quiet.
-- ---------------------------------------------------------------------------
insert into lot_availability (lot_id, day_of_week, hour, typical_pct_full)
select
  l.id,
  d.day_of_week,
  h.hour,
  greatest(0, least(100,
    case
      when d.day_of_week in (0, 6) then
        -- Weekend: quiet all day, a small bump around midday.
        15 + (20 - abs(h.hour - 13) * 3)
      else
        -- Weekday: fills from 8am, peaks 10am to 1pm, empties after 5pm.
        case
          when h.hour < 8  then 20
          when h.hour > 18 then 25
          else 92 - (abs(h.hour - 11) * 9)
        end
    end
    -- Small offset per lot so they are not all identical
    + (length(l.name) % 13) - 6
  ))::smallint
from parking_lots l
cross join generate_series(0, 6)  as d(day_of_week)
cross join generate_series(6, 21) as h(hour)
on conflict (lot_id, day_of_week, hour)
do update set typical_pct_full = excluded.typical_pct_full;

-- Study and hangout spots. noise_level 1 is silent, 5 is loud.
insert into spots (name, kind, building_id, noise_level, has_outlets, seats)
select v.name, v.kind, b.id, v.noise_level, v.has_outlets, v.seats
from (values
  ('Pollak Library Quiet Floor',   'study',  'PL',   1, true,  120),
  ('Pollak Library Commons',       'study',  'PL',   3, true,  200),
  ('ECS Study Area',               'study',  'CS',   2, true,   40),
  ('Engineering Lobby Tables',     'study',  'E',    3, true,   30),
  ('TSU Underground',              'eat',    'TSU',  5, false, 250),
  ('TSU Study Lounge',             'study',  'TSU',  2, true,   60),
  ('Titan Bookstore Cafe',         'eat',    'TSU',  4, true,   45),
  ('Humanities Courtyard',         'meet',   'H',    3, false,  80),
  ('Gordon Hall Charging Bar',     'charge', 'GH',   3, true,   16),
  ('Mihaylo Hall Atrium',          'study',  'SGMH', 2, true,   90),
  ('Education Classroom Lounge',   'study',  'EC',   2, true,   35),
  ('SRC Lounge',                   'meet',   'SRC',  4, true,   50)
) as v(name, kind, code, noise_level, has_outlets, seats)
join buildings b on b.code = v.code
on conflict (name, building_id) do nothing;

-- ---------------------------------------------------------------------------
-- Clubs. Tags are always lowercase and hyphenated, otherwise matching misses
-- silently ("ai" and "AI" are different strings to Postgres).
-- ---------------------------------------------------------------------------
insert into clubs (name, description, tags) values
  ('ACM at CSUF',              'Computing club: talks, workshops, and programming contests.',
     '{software-engineering,algorithms,career,ai}'),
  ('Society of Women Engineers', 'Community and professional development for engineers.',
     '{engineering,career,mentorship,leadership}'),
  ('Titan Data Science',       'Data analysis, machine learning, and Kaggle nights.',
     '{data-science,ai,python,career}'),
  ('Game Development Club',    'Build and ship small games each semester.',
     '{game-dev,design,programming}'),
  ('Cybersecurity Club',       'Capture the flag practice and security fundamentals.',
     '{cybersecurity,networking,ctf}'),
  ('Entrepreneurship Society', 'Startup ideas, pitch practice, and founder talks.',
     '{business,startups,career,leadership}'),
  ('Outdoor Adventure Club',   'Weekend hikes and climbing trips.',
     '{outdoors,fitness,social}'),
  ('Titan Music Collective',   'Open mic nights and jam sessions.',
     '{music,arts,social}')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Events are in db/seed_events.sql because they are dated and get re-run before
-- each demo. Run that file next.
-- ---------------------------------------------------------------------------
