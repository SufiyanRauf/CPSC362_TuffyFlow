-- Tuffy Flow: event seed data
--
-- RUN THIS AGAIN BEFORE EVERY DEMO.
-- Events are dated from the day this is run and we filter out anything already
-- started, so a set seeded in week 1 is all in the past by week 3.

delete from events;

-- at time zone 'America/Los_Angeles' matters here. Without it Postgres reads these
-- as UTC, and every evening event ends up stored as a morning one.
insert into events (club_id, title, starts_at, ends_at, building_id, tags)
select c.id, v.title,
       ((current_date + v.day_offset)::timestamp + v.at_time)
         at time zone 'America/Los_Angeles',
       ((current_date + v.day_offset)::timestamp + v.at_time + interval '90 minutes')
         at time zone 'America/Los_Angeles',
       b.id, v.tags
from (values
  ('ACM at CSUF',               'Resume Workshop with Industry Mentors', 0, time '16:00', 'CS',   '{career,software-engineering}'::text[]),
  ('Titan Data Science',        'Intro to Neural Networks',              0, time '18:00', 'E',    '{ai,data-science,python}'::text[]),
  ('ACM at CSUF',               'Algorithms Practice Session',           1, time '12:00', 'CS',   '{algorithms,software-engineering}'::text[]),
  ('Cybersecurity Club',        'Beginner Capture the Flag Night',       1, time '17:30', 'CS',   '{cybersecurity,ctf}'::text[]),
  ('Game Development Club',     'Unity Basics Workshop',                 2, time '15:00', 'VA',   '{game-dev,programming}'::text[]),
  ('Society of Women Engineers','Mock Interview Evening',                2, time '17:00', 'E',    '{career,mentorship,engineering}'::text[]),
  ('Titan Data Science',        'Kaggle Kickoff',                        3, time '13:00', 'PL',   '{data-science,python}'::text[]),
  ('Entrepreneurship Society',  'Pitch Night',                           3, time '18:30', 'SGMH', '{startups,business,leadership}'::text[]),
  ('ACM at CSUF',               'Git and GitHub for Beginners',          4, time '14:00', 'CS',   '{software-engineering,career}'::text[]),
  ('Outdoor Adventure Club',    'Trail Hike Planning',                   5, time '11:00', 'TSU',  '{outdoors,social}'::text[]),
  ('Titan Music Collective',    'Open Mic Night',                        6, time '19:00', 'TSU',  '{music,arts,social}'::text[]),
  ('Cybersecurity Club',        'Password Cracking Demo',                8, time '16:30', 'E',    '{cybersecurity,networking}'::text[])
) as v(club_name, title, day_offset, at_time, code, tags)
join clubs c     on c.name = v.club_name
join buildings b on b.code  = v.code;
