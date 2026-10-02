-- Tuffy Flow: event seed data
--
-- RUN THIS AGAIN BEFORE EVERY DEMO.
-- Events are dated from the day this is run and we filter out anything already
-- started, so a set seeded in week 1 is all in the past by week 3.
--
-- The events themselves are ours, but they are hosted by real clubs, so
-- club_name below has to match a name in db/seed_clubs.sql exactly. The join is
-- the catch: a name that does not match drops its event silently, which is how
-- a rename once cost us eleven of the twelve without raising a single error.
-- The check at the bottom makes that fail loudly instead.

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
  ('Association for Computing Machinery',        'Resume Workshop with Industry Mentors', 0, time '16:00', 'CS',   '{career,software-engineering}'::text[]),
  ('Data Science and Machine Learning',          'Intro to Neural Networks',              0, time '18:00', 'E',    '{ai,data-science,python}'::text[]),
  ('Association for Computing Machinery',        'Algorithms Practice Session',           1, time '12:00', 'CS',   '{algorithms,software-engineering}'::text[]),
  ('Offensive Security Society',                 'Beginner Capture the Flag Night',       1, time '17:30', 'CS',   '{cybersecurity,ctf}'::text[]),
  ('Video Game Development Club',                'Unity Basics Workshop',                 2, time '15:00', 'VA',   '{game-dev,programming}'::text[]),
  ('Society of Women Engineers',                 'Mock Interview Evening',                2, time '17:00', 'E',    '{career,mentorship,engineering}'::text[]),
  ('Data Science and Machine Learning',          'Kaggle Kickoff',                        3, time '13:00', 'PL',   '{data-science,python}'::text[]),
  ('Business and Data Analytics Club',           'Pitch Night',                           3, time '18:30', 'SGMH', '{startups,business,leadership}'::text[]),
  ('Association for Computing Machinery',        'Git and GitHub for Beginners',          4, time '14:00', 'CS',   '{software-engineering,career}'::text[]),
  ('Ski and Snowboard Club',                     'Trail Hike Planning',                   5, time '11:00', 'TSU',  '{outdoors,social}'::text[]),
  ('Behind The Scenes',                          'Open Mic Night',                        6, time '19:00', 'TSU',  '{music,arts,social}'::text[]),
  ('Offensive Security Society',                 'Password Cracking Demo',                8, time '16:30', 'E',    '{cybersecurity,networking}'::text[])
) as v(club_name, title, day_offset, at_time, code, tags)
join clubs c     on c.name = v.club_name
join buildings b on b.code  = v.code;

-- Twelve rows go in above. If fewer came out, a club or building name stopped
-- matching and the join quietly dropped it.
do $$
declare n integer;
begin
  select count(*) into n from events;
  if n <> 12 then
    raise exception 'seed_events: expected 12 events, got %. A club or building name in this file no longer matches.', n;
  end if;
end $$;
