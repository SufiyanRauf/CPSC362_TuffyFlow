-- Tuffy Flow: study spots and food
--
-- Sources, all read 1 October 2026:
--   Pollak Library study spaces and room booking rules
--     library.fullerton.edu/study-make/study-spaces.html
--   Campus Dining location hours
--     fullerton.edu/food/hours
--   Student Genius Center
--     fullerton.edu/it/services/student-genius-center
--
-- Floor designations, booking rules, dining locations and dining hours are all
-- taken from those pages. noise_level and seats are OUR estimates on our own
-- 1 to 5 scale, not published figures.

delete from spots;

-- Pollak Library. One building, but the floors have different rules, which is
-- why floor and section are columns.
insert into spots (name, kind, building_id, floor, section, noise_level, has_outlets,
                   is_indoor, seats, reservable, opens_at, closes_at, hours_note, source_url)
select v.name, v.kind, b.id, v.floor, v.section, v.noise, v.outlets, true, v.seats,
       v.reservable, v.opens, v.closes, v.note,
       'https://www.library.fullerton.edu/study-make/study-spaces.html'
from (values
  ('Library North 1st Floor',  'study', 1, 'North', 4, true,  120, false, time '07:00', time '23:00', 'Group study space, talking permitted'),
  ('Library North 2nd Floor',  'study', 2, 'North', 4, true,  140, false, time '07:00', time '23:00', 'Group study space, talking permitted'),
  ('Library North 3rd Floor',  'study', 3, 'North', 1, true,   90, false, time '07:00', time '23:00', 'Quiet study floor, phones off'),
  ('Library North 4th Floor',  'study', 4, 'North', 3, true,  110, false, time '07:00', time '23:00', 'Group study space, talking permitted'),
  ('Library South 4th Floor',  'study', 4, 'South', 1, true,   80, false, time '07:00', time '23:00', 'Quiet study floor, phones off'),
  ('Library South 5th Floor',  'study', 5, 'South', 3, true,  100, false, time '07:00', time '23:00', 'Group study space, talking permitted'),
  ('Group Study Rooms',        'meet',  1, 'North', 3, true,    6, true,  time '07:00', time '23:00', 'Bookable in 2 hour slots, 7am to 11pm. Groups of 2 or more need a second CWID. Up to 5 bookings a week, 2 weeks ahead.'),
  ('Student Genius Center',    'charge',1, 'North', 3, true,   20, false, time '08:00', time '17:00', 'Laptop checkout and tech help')
) as v(name, kind, floor, section, noise, outlets, seats, reservable, opens, closes, note)
join buildings b on b.code = 'PL';

-- Campus dining. Hours are per location and taken verbatim from the Campus
-- Dining hours page. No weekend hours are published, so none are stored.
insert into spots (name, kind, building_id, noise_level, has_outlets, is_indoor,
                   seats, opens_at, closes_at, hours_note, source_url)
select v.name, 'eat', b.id, v.noise, v.outlets, v.indoor, v.seats, v.opens, v.closes, v.note,
       'https://www.fullerton.edu/food/hours/'
from (values
  ('Avanti Markets at Nutwood Cafe', 'TSU',  3, true,  true,  40, time '07:00', time '20:00', 'Mon to Thu 7am to 8pm, Fri 7am to 5pm. Grab and go snacks and drinks.'),
  ('Baja Fresh Express',             'TSU',  5, false, true,  60, time '10:00', time '17:00', 'Mon to Thu 10am to 5pm'),
  ('Carl''s Jr.',                    'GH',   4, false, true,  50, time '08:00', time '19:00', 'Mon to Thu 8am to 7pm, Fri 8am to 2pm. Near Gordon Hall.'),
  ('Fresh Kitchen',                  'TSU',  5, false, true,  40, time '10:00', time '15:00', 'Mon to Thu 10am to 3pm, Fri 10am to 2pm'),
  ('Hibachi-San',                    'TSU',  5, false, true,  40, time '09:00', time '19:00', 'Mon to Thu 9am to 7pm, Fri 9am to 2pm'),
  ('Juice It Up!',                   'TSU',  4, false, true,  15, time '08:30', time '18:30', 'Mon to Thu 8:30am to 6:30pm, Fri 8:30am to 1:30pm'),
  ('On-Campus Food Trucks',          'H',    4, false, false, 30, time '11:00', time '13:00', 'Mon to Thu 11am to 1pm, Humanities Plaza'),
  ('Panda Express',                  'TSU',  5, false, true,  60, time '09:00', time '19:00', 'Mon to Thu 9am to 7pm, Fri 9am to 2pm'),
  ('Pieology',                       'TSU',  5, false, true,  50, time '10:00', time '18:00', 'Mon to Thu 10am to 6pm, Fri 10am to 2pm'),
  ('Starbucks Mihaylo Hall',         'SGMH', 4, true,  true,  35, time '08:00', time '19:00', 'Mon to Thu 8am to 7pm'),
  ('Starbucks Pollak Library',       'PL',   4, true,  true,  30, time '07:30', time '19:00', 'Mon to Thu 7:30am to 7pm, Fri 8am to 2pm'),
  ('Starbucks Titan Student Union',  'TSU',  4, true,  true,  45, time '08:00', time '17:00', 'Mon to Thu 8am to 5pm, Fri 8am to 1pm'),
  ('TOGO''S',                        'TSU',  4, false, true,  40, time '10:00', time '18:00', 'Mon to Thu 10am to 6pm, Fri 10am to 2pm')
) as v(name, code, noise, outlets, indoor, seats, opens, closes, note)
join buildings b on b.code = v.code;
