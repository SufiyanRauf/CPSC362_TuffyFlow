-- Demo account schedule
--
-- Run this LAST, and only after you have signed up once in the app.
--
-- Why this is a separate file: schema.sql and seed.sql fill in the campus, which is the same
-- for everybody. A class schedule belongs to a person, and a person only exists once someone
-- has actually signed up. There is no way to seed a user account directly, because Supabase
-- owns the auth tables.
--
-- WHY YOU NEED A DEMO ACCOUNT AT ALL, and this matters for your presentations:
-- a student who has just signed up has no classes, so every recommendation is empty. If your
-- demo is "watch me sign up, now look at the dashboard", the dashboard you are showing the
-- class is a blank state. Demo the signup separately to prove it works, then log in as this
-- account to show the app doing its job.
--
-- HOW TO RUN IT:
--   1. Sign up in your app with an address you will remember, for example
--      tuffydemo@csu.fullerton.edu
--   2. In Supabase, open Authentication, find that user, copy the UUID.
--   3. Paste it into the demo_id value below, replacing the zeros.
--   4. Run this file.

do $$
declare
  -- Replace this with the UUID of your demo user.
  demo_id uuid := '00000000-0000-0000-0000-000000000000';
begin

  if not exists (select 1 from profiles where id = demo_id) then
    raise exception
      'No profile with id %. Sign up in the app first, then copy that user UUID in here.',
      demo_id;
  end if;

  update profiles set
    full_name    = 'Demo Titan',
    major        = 'Computer Science',
    interests    = '{software-engineering,ai,algorithms,music}',
    career_goals = '{career,software-engineering,data-science}',
    permit_type  = 'student',
    noise_pref   = 2
  where id = demo_id;

  delete from class_meetings where profile_id = demo_id;

  -- A schedule spread across the day and across the week, on purpose.
  --
  -- The mockup you presented shows "starts in 42 minutes". That state only exists in the
  -- window before a class. If this account had one class at 11:30 and your professor opened
  -- the app at 2pm, the flagship card on your dashboard would not match the slide you already
  -- showed the class. With classes every couple of hours there is always a next one, at any
  -- plausible time you might be asked to demo.
  --
  -- day_of_week: 0 is Sunday, 1 is Monday, through to 6 for Saturday.
  insert into class_meetings (profile_id, course_code, day_of_week, start_time, end_time, building_id)
  select demo_id, v.course_code, v.day_of_week, v.start_time, v.end_time, b.id
  from (values
    -- Monday, Wednesday, Friday
    ('CPSC 362', 1, time '09:00', time '10:15', 'CS'),
    ('CPSC 335', 1, time '11:30', time '12:45', 'CS'),
    ('MATH 338', 1, time '14:00', time '15:15', 'MH'),
    ('ENGL 301', 1, time '16:30', time '17:45', 'H'),
    ('CPSC 362', 3, time '09:00', time '10:15', 'CS'),
    ('CPSC 335', 3, time '11:30', time '12:45', 'CS'),
    ('MATH 338', 3, time '14:00', time '15:15', 'MH'),
    ('ENGL 301', 3, time '16:30', time '17:45', 'H'),
    ('CPSC 362', 5, time '09:00', time '10:15', 'CS'),
    ('CPSC 335', 5, time '11:30', time '12:45', 'CS'),
    -- Tuesday, Thursday
    ('CPSC 349', 2, time '08:00', time '09:15', 'E'),
    ('PHYS 225', 2, time '10:30', time '11:45', 'MH'),
    ('CPSC 351', 2, time '13:00', time '14:15', 'CS'),
    ('HIST 110', 2, time '15:30', time '16:45', 'LH'),
    ('CPSC 349', 2, time '18:00', time '19:15', 'E'),
    ('CPSC 349', 4, time '08:00', time '09:15', 'E'),
    ('PHYS 225', 4, time '10:30', time '11:45', 'MH'),
    ('CPSC 351', 4, time '13:00', time '14:15', 'CS'),
    ('HIST 110', 4, time '15:30', time '16:45', 'LH'),
    ('CPSC 349', 4, time '18:00', time '19:15', 'E')
  ) as v(course_code, day_of_week, start_time, end_time, code)
  join buildings b on b.code = v.code;

  raise notice 'Demo account ready: % class meetings seeded.',
    (select count(*) from class_meetings where profile_id = demo_id);

end $$;
