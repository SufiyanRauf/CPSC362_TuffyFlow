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
UNKNOWN_FULLNESS = 50
BASE_PARKING_BUFFER_MINUTES = 10

PARKING_WEIGHTS = {"walk": 0.6, "fullness": 0.4}
SPOT_WEIGHTS = {"walk": 0.4, "noise": 0.4, "outlets": 0.2}
EVENT_WEIGHTS = {"tags": 0.6, "walk": 0.2, "soon": 0.2}


def haversine(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def walk_minutes(metres):
    return math.ceil(metres * DETOUR_FACTOR / WALK_METRES_PER_MINUTE)


def normalize(value, best, worst):
    """Always returns 0..1 where 1 is best, against fixed anchors rather than
    the day's own range. Scaling against the candidates makes the top result
    read as 100 percent every time."""
    if best == worst:
        return 0.5
    score = (worst - value) / (worst - best) if best < worst else (value - worst) / (best - worst)
    return max(0.0, min(1.0, score))


def minutes_to_time(minutes):
    minutes %= 24 * 60
    return "%02d:%02d" % (minutes // 60, minutes % 60)


def rank(candidates, filters, factors, weights, top_n, context):
    """Throw out what is impossible, score the rest, sort, explain the top few."""
    survivors = [c for c in candidates if all(f(c, context) for f in filters)]

    results = []
    for c in survivors:
        total = 0.0
        reasons = []
        walk = None
        for name, factor in factors.items():
            out = factor(c, context)
            value, reason = out[0], out[1]
            if len(out) > 2:
                walk = out[2]
            # clamp rather than assert: an assert becomes a 500 in one build and
            # disappears under python -O in another
            value = max(0.0, min(1.0, value))
            total += value * weights[name]
            if reason:
                reasons.append(reason)
        results.append({
            "item": c,
            "score": total,
            "match_percent": round(total * 100),
            "reasons": reasons,
            "walk_minutes": walk,
        })

    # sort on the float, not the rounded percent, or ties break differently
    results.sort(key=lambda r: (-r["score"], r["walk_minutes"] if r["walk_minutes"] is not None else 999,
                                r["item"].get("name", "")))
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
        return lot["permit_type"] == ctx["profile"]["permit_type"]

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
        "filters": [permit_allows],
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
    if context.get("class_day_offset", 0) == 0 and minutes <= context["now_minutes"]:
        return None
    return minutes_to_time(minutes)


# ---------------------------------------------------------------- spots

def spot_config(context):
    def is_open(spot, ctx):
        # Only filter when we actually know the hours. Unknown hours are not a
        # claim that somewhere is open all day.
        if not spot.get("opens_at") or not spot.get("closes_at"):
            return True
        opens = int(spot["opens_at"][:2]) * 60 + int(spot["opens_at"][3:5])
        closes = int(spot["closes_at"][:2]) * 60 + int(spot["closes_at"][3:5])
        at = ctx["now_minutes"]
        if closes < opens:                      # closes after midnight
            return at >= opens or at <= closes
        return opens <= at <= closes

    def walk_factor(spot, ctx):
        metres = haversine(spot["lat"], spot["lng"], ctx["dest_lat"], ctx["dest_lng"])
        mins = walk_minutes(metres)
        if mins <= 1:
            return 1.0, "in the same building as your next class", mins
        return (normalize(mins, BEST_WALK_MINUTES, WORST_WALK_MINUTES),
                "%d min from %s" % (mins, ctx["dest_name"]), mins)

    def noise_factor(spot, ctx):
        pref = ctx["profile"]["noise_pref"]
        # quieter than asked for is fine, louder is what costs
        value = 1.0 if spot["noise_level"] <= pref else 1 - (spot["noise_level"] - pref) / 4
        labels = {1: "silent", 2: "quiet", 3: "some background noise", 4: "lively", 5: "loud"}
        return max(0.0, value), labels.get(spot["noise_level"], "")

    def outlets_factor(spot, ctx):
        return (1.0, "has outlets") if spot.get("has_outlets") else (0.0, "")

    return {
        "filters": [is_open],
        "factors": {"walk": walk_factor, "noise": noise_factor, "outlets": outlets_factor},
        "weights": SPOT_WEIGHTS,
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
        event_day = (ctx["day_of_week"] + event.get("day_offset", 0)) % 7
        for cls in ctx.get("class_meetings", []):
            if (cls["day_of_week"] == event_day
                    and cls["start"] < event["ends_minutes"]
                    and event["starts_minutes"] < cls["end"]):
                return False
        return True

    def tag_factor(event, ctx):
        mine = set(ctx["profile"]["interests"]) | set(ctx["profile"]["career_goals"])
        theirs = set(event.get("tags", []))
        if not theirs:
            return 0.0, ""
        shared = mine & theirs
        if not shared:
            return 0.0, ""
        # over the event's own tags, not the smaller of the two sets, or a
        # single tag event scores a perfect match
        value = len(shared) / len(theirs)
        return min(1.0, value), "matches " + " and ".join(sorted(shared))

    def walk_factor(event, ctx):
        metres = haversine(event["lat"], event["lng"], ctx["dest_lat"], ctx["dest_lng"])
        mins = walk_minutes(metres)
        return (normalize(mins, BEST_WALK_MINUTES, WORST_WALK_MINUTES),
                "%d min away" % mins, mins)

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
