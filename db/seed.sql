-- Tuffy Flow seed data
-- Run after schema.sql. Safe to run more than once.
--
-- Coordinates come from CSUF's own campus map data, fullerton.edu/campusmap/locations.json,
-- retrieved 1 October 2026: all 17 buildings and 10 of the 12 lots. The two
-- exceptions are S8 and S10 and the Visitor Lot, which do not appear in that
-- file at all, so those two are our estimates and are marked below.
-- Campus is 800 N. State College Blvd.

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
  ('Kinesiology and Health Science',     'KHS',  33.882697, -117.886076),
  -- South of Nutwood Avenue. Needed because the campus map puts Avanti Markets
  -- at Nutwood Cafe in this building, not in the Titan Student Union.
  ('College Park',                       'CP',   33.877584, -117.883445),
  ('Bookstore and Titan Shops',          'B',    33.881893, -117.886841)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Parking lots
-- ---------------------------------------------------------------------------
insert into parking_lots (name, lat, lng, permit_type, total_spaces) values
  -- The five counted structures, names and totals taken from the campus parking
  -- availability board. Four of the five have CSUF's own coordinates; S8 and S10
  -- is not in that map file, so its position is our estimate.
  ('Nutwood Structure',              33.879029, -117.88852, 'student', 2484),
  ('State College Structure',        33.883055, -117.888671, 'student', 1373),
  ('Eastside North',                 33.880356, -117.881687, 'student', 1880),
  -- CSUF's map still titles this "Eastside Parking Structure 2 (Under
  -- Construction)", but the availability board reports live counts for it, so
  -- it looks open and the map entry stale.
  ('Eastside South',                 33.881079, -117.881804, 'student', 1341),
  -- Our estimate: not in CSUF's map data.
  ('S8 and S10',                     33.8862, -117.8848, 'student', 2104),
  -- Surface lots, not on the counts board
  ('Lot A',                          33.887246, -117.888922, 'student',  420),
  ('Lot C',                          33.878331, -117.88835, 'student',  380),
  ('Lot D',                          33.884152, -117.887855, 'student',  310),
  ('Lot E',                          33.88188, -117.881648, 'student',  260),
  ('Lot G',                          33.888301, -117.886538, 'student',  340),
  ('Staff Lot J',                    33.88344, -117.882967, 'staff',    180),
  -- Our estimate: CSUF's map data has no visitor lot entry.
  ('Visitor Lot',                    33.8800, -117.8895, 'visitor',  120)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Typical fullness, every lot, every day, 6am to 9pm.
-- Generated rather than typing 1,344 rows. Weekdays peak late morning, weekends
-- stay quiet.
-- ---------------------------------------------------------------------------
-- Per lot demand, in percentage points above or below the time of day curve.
--
-- The five counted structures are measured, from data/parking_samples.csv:
-- Thursday 1 October 2026 13:11 for the weekday column and Sunday 20 September
-- 2026 12:23 for the weekend column. Both columns reproduce their reading to
-- within one point.
--
-- The weekday and weekend shapes are genuinely different, which is why there
-- are two columns rather than one. On a weekday Eastside fills to about 88 per
-- cent because it is closest to the academic buildings while State College sits
-- at 43. On a Sunday every structure is under 4 per cent except S8 and S10 at
-- 59, which is next to the stadium and the gym.
--
-- Only Sunday was sampled for the weekend, so Saturday is an assumption.
--
-- The seven surface lots are not on the board and never have been. Their
-- numbers below are guesses, not measurements and not derived from anything.
with demand(name, weekday_pts, weekend_pts) as (values
    ('Nutwood Structure', -24, -1),
    ('State College Structure', -31, 1),
    ('Eastside North', 12, -3),
    ('Eastside South', 14, -1),
    ('S8 and S10', -9, 56),
    ('Lot A', -18, 0),
    ('Lot C', -13, 0),
    ('Lot D', -3, 0),
    ('Lot E', 0, 0),
    ('Lot G', -20, 0),
    ('Staff Lot J', -28, 0),
    ('Visitor Lot', -33, 0)
)
insert into lot_availability (lot_id, day_of_week, hour, typical_pct_full)
select
  l.id,
  d.day_of_week,
  h.hour,
  -- Floor 2, ceiling 99. A typical pattern should not claim a lot is literally
  -- empty or literally full. Early and late the per lot offsets are larger than
  -- the base, so the lots converge, which is correct: at 7am they really are all
  -- empty and the walk is what should decide.
  greatest(2, least(99,
    case when d.day_of_week in (0, 6)
      then 1 + greatest(0, 3 - abs(h.hour - 13)) + coalesce(dm.weekend_pts, 0)
      else case
             when h.hour < 8  then 20
             when h.hour > 18 then 25
             else 92 - (abs(h.hour - 11) * 9)
           end + coalesce(dm.weekday_pts, 0)
    end
  ))::smallint
from parking_lots l
left join demand dm on dm.name = l.name
cross join generate_series(0, 6)  as d(day_of_week)
cross join generate_series(6, 21) as h(hour)
on conflict (lot_id, day_of_week, hour)
do update set typical_pct_full = excluded.typical_pct_full;

-- Spots and clubs used to be seeded here with placeholder rows. They are now
-- real data in db/seed_spots.sql and db/seed_clubs.sql, so the blocks are gone
-- rather than left to collide: the old 'Society of Women Engineers' row clashed
-- with the real TitanLink one on clubs.name and rolled the whole insert back.

-- ---------------------------------------------------------------------------
-- Run order, all from the db/ directory:
--   schema.sql  ->  seed.sql  ->  seed_clubs.sql  ->  seed_spots.sql  ->  seed_events.sql
--
-- Events are last because they are dated and get re-run before each demo.
-- ---------------------------------------------------------------------------
