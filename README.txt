Tuffy Flow
==========

Tuffy Flow was built by Sufiyan Rauf, Bhavy Patel and Phillip Bryan for
CPSC 362, Fall 2026.

It is a web app for CSUF students. Give it your class schedule and a few
preferences and it works out where to park, where to study, which clubs match
your interests and what events are coming up.

Open it
-------

Visit https://tuffyflow.vercel.app in any browser. There is nothing to install.
Running it from the code instead is at the bottom of this file.

Make an account
---------------

Two ways to make one, both on the login card.

Click "Continue with Google" and pick an account in the popup. The name on the
Google account becomes the name on your profile, which is one box less to fill
in.

Or click "Create account" and enter a name, an email and a password of at least
six characters. Any email address works; the csu.fullerton.edu one in the box
is a placeholder. If you forget the password later, the "Forgot password?" link
on the Log in card emails you a reset link.

If you would rather not sign up at all, "View demo" opens the app on a sample
student who already has a schedule and interests in place. Nothing you save in
the demo is kept.

Start with Profile
------------------

Everything the app recommends is worked out from your profile. Open "Profile"
from the sidebar, or from the bar along the bottom on a phone. It opens on a
"Finish setting up" panel listing what is still missing.

Add your classes first. Every walk the app measures runs to or from a class, so
an empty schedule leaves the Dashboard, Parking and Events screens with nothing
to rank, and all three say so rather than guess. Under "Weekly schedule", fill
in Course, Day, Starts, Ends and Building, then click "Add class". That row
saves immediately, and the "Save changes" button higher up the page does not
cover the schedule. A Monday and Wednesday lecture needs two rows, one for
each day.

Then fill in "Your details", the box above the schedule.

Pick your parking permit. A lot only appears if it takes your permit, so if you
leave this blank the Parking screen has nothing to rank.

Drag the noise slider to the loudest you can work in. Anywhere quieter counts
as just as good a match, and louder places rank lower.

Add a few interests and career goals, one at a time. They are matched word for
word against the tags printed on the club and event cards, so copy a tag you
have seen on a card rather than inventing a word of your own.

None of that box is saved until you click "Save changes" at the bottom of it.
Once it is, go back to the Dashboard and the recommendations fill in.

What each screen does
---------------------

Screen     What it shows
---------  ----------------------------------------------------------------------
Dashboard  Your next class, today's schedule, and the top parking, spot and event
Parking    The lots your permit covers, in order, with a campus map
Spots      Somewhere to work, eat or meet, filtered by type, noise and outlets
Clubs      All 320 clubs, 20 to a page, matches first, otherwise alphabetical
Events     Upcoming events ranked for you, minus anything that overlaps a class

On a wide screen the sidebar groups them, with Dashboard on its own at the top.
"Around class" holds Parking and Spots, "Campus life" holds Clubs and Events,
and "You" holds Profile.

Running it on your own machine
------------------------------

You need Node 22.18 or newer and Python 3.10 or newer. Run python3 -V first.
macOS still ships python3 as 3.9, and if that is what you have, install a newer
Python and use its name in place of python3 in the second block below, as in
python3.12 -m venv .venv.

Unzip or clone the project, open a terminal in that folder, and run:

    npm install
    npm run dev

That serves the app on http://localhost:5173, or on the next free port, which
the dev server prints when it starts.

The rankings come from a small Python scoring service, so start that in a
second terminal. Without it the Dashboard, Parking and Events screens say the
scoring service is not answering:

    python3 -m venv .venv && .venv/bin/pip install -r api/requirements.txt
    .venv/bin/python -m uvicorn api.recommend:app --port 8000

On Windows those two paths are .venv\Scripts\pip and .venv\Scripts\python.

With both of those running, "View demo" works the same as it does online.
Signing in and saving your own data needs a Firebase project of your own, so
the demo is the way in on a fresh copy of the code.
