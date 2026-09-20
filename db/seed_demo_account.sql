-- Demo account schedule
--
-- Run this last, after signing up once in the app.
--
-- Separate file because a schedule belongs to a person, and the person only exists once
-- someone has signed up. A fresh account has no classes, so demos need this account or
-- every card is empty.
--
-- How to run it:
--   1. Sign up with tuffydemo@csu.fullerton.edu
--   2. Copy that user's UUID from Authentication in Supabase
--   3. Paste it in below, replacing the zeros

do $$
declare
  -- demo account UUID goes here
  demo_id uuid := '00000000-0000-0000-0000-000000000000';
begin

  update profiles set
    full_name    = 'Demo Titan',
    major        = 'Computer Science',
    interests    = '{software-engineering,ai,algorithms,music}',
    career_goals = '{career,software-engineering,data-science}',
    permit_type  = 'student',
    noise_pref   = 2
  where id = demo_id;

  delete from class_meetings where profile_id = demo_id;

  -- Classes spread across the day and week so there is always a next one to show,
  -- whatever time we end up demoing.
  -- day_of_week: 0 is Sunday through 6 for Saturday.
  insert into class_meetings (profile_id, course_code, day_of_week, start_time, end_time, building_id)
  select demo_id, v.course_code, v.day_of_week, v.start_time, v.end_time, b.id
  from (values
    -- Monday, Wednesday, Friday
    ('CPSC 335', 1, time '09:00', time '10:15', 'CS'),
    ('CPSC 362', 1, time '11:30', time '12:45', 'CS'),
    ('MATH 338', 1, time '14:00', time '15:15', 'MH'),
    ('ENGL 301', 1, time '16:30', time '17:45', 'H'),
    ('CPSC 335', 3, time '09:00', time '10:15', 'CS'),
    ('CPSC 362', 3, time '11:30', time '12:45', 'CS'),
    ('MATH 338', 3, time '14:00', time '15:15', 'MH'),
    ('ENGL 301', 3, time '16:30', time '17:45', 'H'),
    ('CPSC 335', 5, time '09:00', time '10:15', 'CS'),
    ('CPSC 362', 5, time '11:30', time '12:45', 'CS'),
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

end $$;
