-- Tuffy Flow seed data
-- Run after schema.sql. Safe to run more than once.
--
-- Building coordinates come from CSUF's own campus map data,
-- fullerton.edu/campusmap/locations.json, retrieved 1 October 2026.
-- Parking is a different story: that file still uses the lot letters CSUF
-- retired in summer 2025, so the lots below were rebuilt from the parking
-- map at parking.fullerton.edu on 9 October 2026 instead. See the note above
-- the parking insert.
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
insert into parking_lots (name, lat, lng, permits, total_spaces) values
  -- Read off CSUF's parking map, parking.fullerton.edu/_resources/pdfs/campus-parking-map.pdf,
  -- on 9 October 2026. That is the sheet that names the lots; the general campus
  -- map's locations.json still uses the pre-2025 letters and is only good for
  -- geometry now. CSUF renumbered everything in summer 2025 against the campus
  -- entrance numbers, so there is no Lot A, C, D, E, G or J any more, and the
  -- gaps in the S and E numbering are real.
  --
  -- total_spaces is null unless CSUF publishes a figure. Only the counts board
  -- does, and it reports S8 and S10 together as 2,104, which is not a number
  -- for either lot on its own, so neither one carries it.
  ('Nutwood Parking Structure',       33.879051, -117.888524, array['student','employee','visitor'],  2484),
  ('State College Parking Structure', 33.883053, -117.888598, array['student','employee','visitor'],  1373),
  ('Eastside North Parking Structure',33.881079, -117.881804, array['student'],                       1880),
  -- The parking map calls this Eastside South, but locations.json and Google
  -- both still use the older name, Eastside Parking Structure, from before the
  -- north one was built. That is why the directions link searches for the old
  -- name: the real one does not resolve.
  ('Eastside South Parking Structure',33.880356, -117.881687, array['student','employee','visitor'],  1341),
  -- The stadium lots. Freshmen in the halls park at S8 and shuttle in.
  ('S8',                33.887313, -117.888798, array['student','employee','resident'], null),
  ('S10',                             33.888324, -117.886559, array['student','employee','visitor'],  null),
  -- Employee lots
  ('E1',               33.881478, -117.882968, array['employee'],                      null),
  ('E3',             33.878491, -117.888764, array['employee'],                      null),
  ('E6',                              33.883894, -117.883608, array['employee'],                      null),
  -- Resident lots, for students living on campus
  ('R1',          33.88188,  -117.881648, array['resident'],                      null),
  ('R2',                              33.884217, -117.881243, array['resident'],                      null),
  -- The only hourly facility that is a lot of its own rather than a zone
  -- inside a structure
  -- CSUF marks this one hourly but gives it no code and no coordinate, so the
  -- point is ours, read off satellite imagery.
  ('Student Union Way (hourly)',      33.881858, -117.889334, array['visitor'],                       null)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Typical fullness, every lot, every day, 6am to 9pm.
-- Generated rather than typing 1,344 rows. Weekdays peak late morning, weekends
-- stay quiet.
-- ---------------------------------------------------------------------------
-- Per lot demand, in percentage points above or below the time of day curve.
--
-- The six counted facilities are measured, from data/parking_samples.csv:
-- Thursday 1 October 2026 13:11 for the weekday column and Sunday 20 September
-- 2026 12:23 for the weekend column. Both columns reproduce their reading to
-- within one point.
--
-- The weekday and weekend shapes are genuinely different, which is why there
-- are two columns rather than one. On a weekday Eastside fills to about 88 per
-- cent because it is closest to the academic buildings while State College sits
-- at 43. On a Sunday every structure is under 4 percent except S8 and S10 at
-- 59, which are next to the stadium and the gym. State College is the highest
-- of the four at almost exactly 4 percent.
--
-- Only Sunday was sampled for the weekend, so Saturday is an assumption.
--
-- The six employee, resident and hourly lots are not on the board and never
-- have been. Their numbers below are guesses, not measurements and not derived
-- from anything.
with demand(name, weekday_pts, weekend_pts) as (values
    ('Nutwood Parking Structure', -24, -1),
    ('State College Parking Structure', -31, 1),
    ('Eastside North Parking Structure', 12, -3),
    ('Eastside South Parking Structure', 14, -1),
    -- the board reports these two as one row, so the pair's reading is the
    -- best there is for either of them alone
    ('S8', -9, 56),
    ('S10', -9, 56),
    -- Guesses from here down. Employee lots are small and fill early, then
    -- empty out at the weekend when nobody is at work.
    ('E1', -10, 0),
    ('E3', -13, 0),
    ('E6', -18, 0),
    -- Resident lots go the other way: the cars belong to people who live
    -- there, so they stay put at the weekend instead of going home.
    ('R1', -5, 45),
    ('R2', -5, 45),
    -- A small lot that fills before the structures do.
    ('Student Union Way (hourly)', 5, -30)
)
insert into lot_availability (lot_id, day_of_week, hour, typical_pct_full)
select
  l.id,
  d.day_of_week,
  h.hour,
  -- Floor 1, ceiling 99. A typical pattern should not claim a lot is literally
  -- empty or literally full. A floor of 2 would have put Eastside North at 2 on
  -- the weekend against a real 0.48, which breaks the one point claim below.
  -- Early and late the offsets exceed the base so the lots converge, which is
  -- right: at 7am they really are all empty and the walk is what should decide.
  greatest(1, least(99,
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
