-- Tuffy Flow seed data
-- Run after schema.sql. Safe to run more than once.
--
-- The coordinates below are approximate. Phillip is replacing them with real ones
-- taken off a map, since the pins have to sit on the actual buildings.

-- ---------------------------------------------------------------------------
-- Buildings
-- ---------------------------------------------------------------------------
insert into buildings (name, code, lat, lng) values
  ('McCarthy Hall',                      'MH',   33.8796, -117.8853),
  ('Langsdorf Hall',                     'LH',   33.8788, -117.8837),
  ('Pollak Library',                     'PL',   33.8814, -117.8852),
  ('Titan Student Union',                'TSU',  33.8828, -117.8878),
  ('Computer Science',                   'CS',   33.8824, -117.8829),
  ('Engineering',                        'E',    33.8820, -117.8826),
  ('Dan Black Hall',                     'DBH',  33.8801, -117.8845),
  ('Humanities',                         'H',    33.8806, -117.8866),
  ('Education Classroom',                'EC',   33.8811, -117.8872),
  ('Gordon Hall',                        'GH',   33.8803, -117.8859),
  ('Steven G. Mihaylo Hall',             'SGMH', 33.8785, -117.8823),
  ('Titan Gym',                          'TG',   33.8837, -117.8859),
  ('Student Recreation Center',          'SRC',  33.8841, -117.8872),
  ('Visual Arts',                        'VA',   33.8790, -117.8887),
  ('Kinesiology and Health Science',     'KHS',  33.8834, -117.8845)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Parking lots
-- ---------------------------------------------------------------------------
insert into parking_lots (name, lat, lng, permit_type, total_spaces) values
  ('Nutwood Parking Structure',       33.8791, -117.8890, 'student', 2100),
  ('Eastside Parking Structure',      33.8817, -117.8809, 'student', 1900),
  ('State College Parking Structure', 33.8845, -117.8886, 'student', 1400),
  ('Lot A',                           33.8852, -117.8852, 'student',  420),
  ('Lot C',                           33.8846, -117.8827, 'student',  380),
  ('Lot D',                           33.8838, -117.8814, 'student',  310),
  ('Lot E',                           33.8779, -117.8875, 'student',  260),
  ('Lot G',                           33.8783, -117.8841, 'student',  340),
  ('Lot I',                           33.8809, -117.8806, 'student',  290),
  ('Lot J',                           33.8856, -117.8869, 'staff',    180),
  ('Lot K',                           33.8776, -117.8858, 'staff',    150),
  ('Visitor Lot',                     33.8800, -117.8895, 'visitor',  120)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Typical fullness, every lot, every day, 6am to 9pm.
-- Generated rather than typing ~1300 rows. Weekdays peak late morning, weekends
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
