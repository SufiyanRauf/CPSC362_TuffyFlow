"""Ranking engine. Pure functions, no web framework, no database.

Parking, spots and events are the same algorithm with different filters,
factors and weights, so there is one rank() and three configurations.
"""

import math

EARTH_RADIUS_M = 6371000
DETOUR_FACTOR = 1.3
WALK_METRES_PER_MINUTE = 80
BEST_WALK_MINUTES = 2
WORST_WALK_MINUTES = 20

# Past this, the walk is not a long walk, it is a wrong coordinate. One lot
# with 0, 0 on it measured 203903 minutes to class and still ranked second,
# with "203903 min walk" printed on its card and an arrive-by time beside it.
# The longest honest walk on this campus is about 15 minutes end to end, so an
# hour is four times the worst real case and still nowhere near what a mistyped
# coordinate produces: being a degree out is about 100 km, which is a day and a
# half of walking.
MAX_PLAUSIBLE_WALK_MINUTES = 60

UNKNOWN_FULLNESS = 50
BASE_PARKING_BUFFER_MINUTES = 10

# How far either side of a class we are willing to claim it still says where
# you are. Three hours covers getting there, being there and leaving. Past
# that, a class that ended this morning tells you nothing about where someone
# is at seven in the evening.
MAX_ANCHOR_GAP_MINUTES = 180

# What the walk factor scores when nothing anchors the day. The midpoint, so
# distance neither helps nor hurts and the other factors decide.
NEUTRAL_WALK = 0.5

# What a factor returns in place of a number when there is nothing to judge.
# rank() leaves it out of the score and the factors that did have something to
# say divide its weight between them, which is the same redistribution the
# no-noise weight table below does. A table cannot do this job on its own,
# because whether the tags can be judged depends on the event as well as on the
# profile, so it has to be decided one candidate at a time.
NOTHING_TO_JUDGE = None



PARKING_WEIGHTS = {"walk": 0.6, "fullness": 0.4}
SPOT_WEIGHTS = {"walk": 0.4, "noise": 0.4, "outlets": 0.2}

# What spot scoring weighs when the profile has no noise preference on it,
# which is every account until somebody fills the profile screen in.
#
# The first attempt scored the factor at the midpoint instead, on the reasoning
# that half is neutral. It is not. Noise is a ceiling, so a stated preference
# scores 1.0 for every spot at or under it, which is most of them; half is
# therefore the bottom of the range that actually comes up, not the middle.
# Measured, it cost a new account about twenty points on every study spot, and
# it handed the ordering to outlets, a factor with half the weight.
#
# So the factor is not scored at all and the other two take its share. The
# noise function still runs, because how loud somewhere is is worth reading
# whether or not we know what was wanted, but it is multiplied by nothing. A
# percentage then means the same thing it always did: how much of what we can
# judge this place gets right.
SPOT_WEIGHTS_NO_NOISE = {"walk": 2 / 3, "noise": 0.0, "outlets": 1 / 3}

# There is no second table for events, and the reason is worth writing down,
# because the tag factor has exactly the same problem. A new account has no
# interests and no career goals on it, and some events carry no tags at all,
# and in both cases there is nothing to compare. Scored at zero against a
# weight of 0.6 that put every event on a new account's first visit at 30
# percent, which is what an event actively wrong for somebody should read.
#
# A table cannot fix it the way it fixed noise, because a noise preference is
# missing for the whole request while tags can be unjudgeable for one event and
# fine for the next. So the tag factor returns NOTHING_TO_JUDGE and rank()
# redistributes its weight per event. The effect is the same, decided later.
EVENT_WEIGHTS = {"tags": 0.6, "walk": 0.2, "soon": 0.2}


def haversine(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    # a can round just above 1 for two points on opposite sides of the planet,
    # and sqrt of a negative raises rather than returning a number. Nothing on
    # campus is anywhere near that, but the endpoint takes any coordinate on
    # the globe, and a 500 out of the arithmetic is what the bounds exist to
    # avoid.
    return 2 * EARTH_RADIUS_M * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1 - a)))


def walk_minutes(metres):
    return math.ceil(metres * DETOUR_FACTOR / WALK_METRES_PER_MINUTE)


def normalize(value, best, worst):
    """Always returns 0..1 where 1 is best, against fixed anchors rather than
    the day's own range. Scaling against the candidates makes the top result
    read as 100 percent every time."""
    if best == worst:
        return 0.5
    score = (worst - value) / (worst - best) if best < worst else (value - worst) / (best - worst)
    # same guard as the one in rank, and for the same reason: max and min hand
    # not-a-number straight back, so clamping it alone would read as a perfect
    # score rather than no score
    return 0.0 if score != score else max(0.0, min(1.0, score))


def minutes_to_time(minutes):
    minutes %= 24 * 60
    return "%02d:%02d" % (minutes // 60, minutes % 60)


def anchor_for(context, day, minutes):
    """The class that says where the student is at that point in the week, or
    None when nothing does.

    Everything used to be measured from the building of the next class. That is
    right for parking, because the next class is what you are parking for, and
    wrong for everything else. On a Friday afternoon it would tell you a study
    spot was two minutes away when it meant two minutes from Monday morning's
    lecture hall, which is not a walk anyone is about to take.

    So each day is looked at on its own, and only a class close enough in time
    counts. Returning None rather than guessing a point on campus matters: the
    guess would quietly rank whatever sits nearest that point first, and it
    would be a ranking built on nothing.
    """
    nearest = None
    for cls in context.get("class_meetings", []):
        if cls["day_of_week"] != day or cls.get("lat") is None or cls.get("lng") is None:
            continue
        if cls["start"] <= minutes <= cls["end"]:
            gap = 0
        else:
            gap = min(abs(cls["start"] - minutes), abs(cls["end"] - minutes))
        # a class still to come beats one already over at the same distance,
        # otherwise the answer depends on the order the schedule happens to be in
        #
        # Everything after that is the same tie-break rank() has on item id, and
        # for the same reason. Two courses may legally meet on the same day at
        # the same time in different buildings, the schedule's uniqueness key
        # includes the course code, and those two tie on gap, on upcoming and on
        # start. Whichever Firestore handed back first then won, so two
        # identical requests came back with different walks and different
        # buildings in the reason. ClassWindow carries no id, so the key runs on
        # to the rest of what it does carry and the order is fixed by the data.
        key = (gap, 0 if cls["end"] >= minutes else 1, cls["start"], cls["end"],
               cls["lat"], cls["lng"], cls.get("building_name") or "")
        if nearest is None or key < nearest[0]:
            nearest = (key, cls)
    if nearest is None or nearest[0][0] > MAX_ANCHOR_GAP_MINUTES:
        return None
    cls = nearest[1]
    return cls["lat"], cls["lng"], cls.get("building_name") or "your class"


def rank(candidates, filters, factors, weights, top_n, context):
    """Throw out what is impossible, score the rest, sort, explain the top few."""
    survivors = [c for c in candidates if all(f(c, context) for f in filters)]

    results = []
    for c in survivors:
        total = 0.0
        judged = 0.0
        reasons = []
        walk = None
        for name, factor in factors.items():
            out = factor(c, context)
            value, reason = out[0], out[1]
            if len(out) > 2:
                walk = out[2]
            if value is NOTHING_TO_JUDGE:
                # Out of the score altogether, not scored at zero. Zero says
                # this candidate is wrong for the student, and the truth is
                # that we have nothing to go on. The weight it would have
                # carried goes to the factors that did have something to say.
                if reason:
                    reasons.append(reason)
                continue
            # Clamp rather than assert: an assert becomes a 500 in one build
            # and disappears under python -O in another. The first test is for
            # not-a-number, which is only false for itself: min and max would
            # both hand it straight back, and max(0.0, min(1.0, nan)) is 1.0,
            # so a factor that went wrong would score a perfect match.
            value = 0.0 if value != value else max(0.0, min(1.0, value))
            total += value * weights[name]
            judged += weights[name]
            if reason:
                reasons.append(reason)
        # Over the weight actually judged rather than over 1.0, so a percentage
        # keeps meaning what it always did: how much of what we can judge this
        # one gets right. Nothing judgeable at all cannot happen today, since
        # walk and soon always return a number, but it would be a division by
        # zero rather than a low score if it ever did.
        score = total / judged if judged else 0.0
        results.append({
            "item": c,
            "score": score,
            "match_percent": round(score * 100),
            "reasons": reasons,
            "walk_minutes": walk,
        })

    # sort on the float, not the rounded percent, or ties break differently
    # id last, because the first three can all tie and Firestore does not
    # promise the order rows come back in, so the same data could otherwise
    # rank differently between two refreshes.
    results.sort(key=lambda r: (-r["score"], r["walk_minutes"] if r["walk_minutes"] is not None else 999,
                                r["item"].get("name", ""), r["item"].get("id", "")))
    return results[:top_n]


# ---------------------------------------------------------------- parking

def class_day(context):
    """The day the next class falls on. On a Friday evening the next class is
    Monday, so the occupancy row to read is Monday's, not today's."""
    return (context["day_of_week"] + context.get("class_day_offset", 0)) % 7


def lot_fullness(lot, context):
    for row in context.get("availability", []):
        if (row["lot_id"] == lot["id"]
                and row["hour"] == context["arrival_hour"]
                and row["day_of_week"] == class_day(context)):
            return row["typical_pct_full"], True
    return UNKNOWN_FULLNESS, False


def parking_config(context):
    def permit_allows(lot, ctx):
        # None until the profile screen is filled in, and None matches nothing
        # on purpose. Every lot takes some permits and not others, so without
        # knowing which one you hold there is no lot we can stand behind. The
        # profile screen says that is why parking is empty.
        permit = ctx["profile"].get("permit_type")
        return permit is not None and permit in lot["permits"]

    def walk_is_plausible(lot, ctx):
        # A lot whose coordinates are wrong is not a lot anybody can park in.
        # Given 0, 0 the scoring measured the walk anyway and offered the lot
        # second with "203903 min walk" on the card, which is a 141 day walk
        # presented as a plan. The browser already refuses to rank parking at
        # all when the destination building has gone missing, for the same
        # reason, and this is the other end of the same line.
        #
        # Filtered rather than scored, the way a lot whose permit does not
        # match is: a walk nobody will ever take is not a worse recommendation,
        # it is not a recommendation. Study spots and events do not need the
        # same guard, because their coordinates come from a building the
        # browser looked up and it drops the row when that lookup fails.
        metres = haversine(lot["lat"], lot["lng"], ctx["dest_lat"], ctx["dest_lng"])
        return walk_minutes(metres) <= MAX_PLAUSIBLE_WALK_MINUTES

    def walk_factor(lot, ctx):
        metres = haversine(lot["lat"], lot["lng"], ctx["dest_lat"], ctx["dest_lng"])
        mins = walk_minutes(metres)
        return (normalize(mins, BEST_WALK_MINUTES, WORST_WALK_MINUTES),
                "%d min walk to %s" % (mins, ctx["dest_name"]), mins)

    def fullness_factor(lot, ctx):
        pct, known = lot_fullness(lot, ctx)
        if not known:
            return 1 - pct / 100, "no typical reading for that hour"
        return (1 - pct / 100,
                "usually about %d%% full when you would arrive" % pct)

    return {
        "filters": [permit_allows, walk_is_plausible],
        "factors": {"walk": walk_factor, "fullness": fullness_factor},
        "weights": PARKING_WEIGHTS,
    }


def arrive_by(lot, context, walk):
    """Class start minus the walk minus a buffer. The buffer grows when the lot
    is usually full, which is a second honest use of the occupancy data.

    Returns None only when the time has genuinely passed, which can only happen
    for a class later today. For a class on another day the time still stands."""
    pct, _ = lot_fullness(lot, context)
    buffer_minutes = BASE_PARKING_BUFFER_MINUTES + round(pct / 100 * 10)
    minutes = context["class_start_minutes"] - (walk or 0) - buffer_minutes
    # Before midnight on the day of the class. minutes_to_time wraps, so this
    # used to answer a 09:00 class with "leave at 16:05" rather than admitting
    # there is no sensible time to give.
    if minutes < 0:
        return None
    if context.get("class_day_offset", 0) == 0 and minutes <= context["now_minutes"]:
        return None
    return minutes_to_time(minutes)


# ---------------------------------------------------------------- spots

def spot_config(context):
    def is_open(spot, ctx):
        # Shut today is the end of it, whatever the clock says. Almost every
        # food place on this campus publishes Monday to Thursday hours and
        # nothing else, so without this the app offered fifteen of the sixteen
        # on a Saturday and all sixteen on a Sunday, each with a match score.
        if spot.get("closed_today"):
            return False
        # Only filter on the clock when we actually know the hours. Unknown
        # hours are not a claim that somewhere is open all day.
        if not spot.get("opens_at") or not spot.get("closes_at"):
            return True
        opens = int(spot["opens_at"][:2]) * 60 + int(spot["opens_at"][3:5])
        closes = int(spot["closes_at"][:2]) * 60 + int(spot["closes_at"][3:5])
        at = ctx["now_minutes"]
        # Closing after midnight. Nothing on campus does at the moment, and
        # per day hours cannot express it properly anyway: the small hours of
        # Saturday belong to Saturday, which would read as shut. Left in
        # because it is right for the one pair of times it is given.
        if closes < opens:
            return at >= opens or at <= closes
        return opens <= at <= closes

    def walk_factor(spot, ctx):
        # measured from where you are today, not from your next class, which
        # may be on another day entirely
        anchor = anchor_for(ctx, ctx.get("day_of_week", 0), ctx["now_minutes"])
        if anchor is None:
            return NEUTRAL_WALK, "no class today to measure a walk from", None
        lat, lng, place = anchor
        metres = haversine(spot["lat"], spot["lng"], lat, lng)
        mins = walk_minutes(metres)
        if mins <= 1:
            return 1.0, "right by %s" % place, mins
        return (normalize(mins, BEST_WALK_MINUTES, WORST_WALK_MINUTES),
                "measured from %s" % place, mins)

    def noise_factor(spot, ctx):
        pref = ctx["profile"].get("noise_pref")
        labels = {1: "silent", 2: "quiet", 3: "some background noise", 4: "lively", 5: "loud"}
        label = labels.get(spot["noise_level"], "")
        if pref is None:
            # Carried for the label alone. Its weight is zero, so the number
            # here cannot move anything.
            return 0.0, label
        # quieter than asked for is fine, louder is what costs
        value = 1.0 if spot["noise_level"] <= pref else 1 - (spot["noise_level"] - pref) / 4
        return max(0.0, value), label

    def outlets_factor(spot, ctx):
        return (1.0, "has outlets") if spot.get("has_outlets") else (0.0, "")

    known_preference = context["profile"].get("noise_pref") is not None
    return {
        "filters": [is_open],
        "factors": {"walk": walk_factor, "noise": noise_factor, "outlets": outlets_factor},
        "weights": SPOT_WEIGHTS if known_preference else SPOT_WEIGHTS_NO_NOISE,
    }


# ---------------------------------------------------------------- events

def event_config(context):
    def not_started(event, ctx):
        if event["day_offset"] < 0:
            return False
        return event["starts_minutes"] > ctx["now_minutes"] or event["day_offset"] > 0

    def no_class_clash(event, ctx):
        """An event the student cannot attend is not a recommendation.

        This used to check day_offset == 0 against a list of only today's
        classes, so every event on a later day skipped the check entirely and
        the top card could sit on top of a class."""
        event_day = (ctx.get("day_of_week", 0) + event.get("day_offset", 0)) % 7
        starts = event["starts_minutes"]
        # An event that runs past midnight comes back with an end smaller than
        # its start, and "class starts before the event ends" is then false for
        # every class of the day, so the check quietly passed everything. Treat
        # it as running to the end of the day instead, which is the part of it
        # that can actually clash with a class.
        ends = event["ends_minutes"]
        if ends < starts:
            ends = 24 * 60
        for cls in ctx.get("class_meetings", []):
            if (cls["day_of_week"] == event_day
                    and cls["start"] < ends
                    and starts < cls["end"]):
                return False
        return True

    def tag_factor(event, ctx):
        mine = set(ctx["profile"]["interests"]) | set(ctx["profile"]["career_goals"])
        theirs = set(event.get("tags", []))
        # Nothing to compare on either side, so there is nothing to judge. A
        # brand new account has no interests and no career goals, which is what
        # the profile document holds until somebody fills the profile screen
        # in, and an event can arrive with no tags of its own. Both used to
        # score zero against a weight of 0.6, so every event on a new account's
        # first visit read 30 percent, the same as an event that is actively
        # wrong for them. See the note on EVENT_WEIGHTS.
        if not mine or not theirs:
            return NOTHING_TO_JUDGE, ""
        shared = mine & theirs
        # No overlap is a real answer, unlike the two cases above: we know what
        # the student wants, we know what the event is about, and they do not
        # meet. That earns a zero.
        if not shared:
            return 0.0, ""
        # over the event's own tags, not the smaller of the two sets, or a
        # single tag event scores a perfect match
        value = len(shared) / len(theirs)
        return min(1.0, value), "matches " + " and ".join(sorted(shared))

    def walk_factor(event, ctx):
        # from wherever you will be on the event's own day. "9 min away" used to
        # mean nine minutes from your next class, so a Saturday event was
        # measured from a Monday lecture.
        day = (ctx.get("day_of_week", 0) + event.get("day_offset", 0)) % 7
        anchor = anchor_for(ctx, day, event["starts_minutes"])
        if anchor is None:
            return NEUTRAL_WALK, "no class that day to measure a walk from", None
        lat, lng, place = anchor
        metres = haversine(event["lat"], event["lng"], lat, lng)
        mins = walk_minutes(metres)
        if mins <= 1:
            return 1.0, "right by %s" % place, mins
        return (normalize(mins, BEST_WALK_MINUTES, WORST_WALK_MINUTES),
                "measured from %s" % place, mins)

    def soon_factor(event, ctx):
        days = event.get("day_offset", 0)
        if days <= 0:
            return 1.0, "today"
        # anchored from 0 so the curve falls the whole way. The old version
        # special cased one day at 0.8 while two days came out at 0.875, so an
        # event the day after tomorrow outranked one tomorrow.
        label = "tomorrow" if days == 1 else "in %d days" % days
        return normalize(days, 0, 9), label

    return {
        "filters": [not_started, no_class_clash],
        "factors": {"tags": tag_factor, "walk": walk_factor, "soon": soon_factor},
        "weights": EVENT_WEIGHTS,
    }
