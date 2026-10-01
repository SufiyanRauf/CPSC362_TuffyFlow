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
EVENT_WEIGHTS = {"tags": 0.7, "walk": 0.3}


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
        for name, factor in factors.items():
            value, reason = factor(c, context)
            assert 0.0 <= value <= 1.0, "factor %s returned %r" % (name, value)
            total += value * weights[name]
            if reason:
                reasons.append(reason)
        results.append({
            "item": c,
            "score": total,
            "match_percent": round(total * 100),
            "reasons": reasons,
        })

    # sort on the float, not the rounded percent, or ties break differently
    results.sort(key=lambda r: (-r["score"], r["item"].get("_walk", 0), r["item"].get("name", "")))
    return results[:top_n]


# ---------------------------------------------------------------- parking

def lot_fullness(lot, context):
    for row in context.get("availability", []):
        if row["lot_id"] == lot["id"] and row["hour"] == context["arrival_hour"]:
            return row["typical_pct_full"], True
    return UNKNOWN_FULLNESS, False


def parking_config(context):
    def permit_allows(lot, ctx):
        return lot["permit_type"] == ctx["profile"]["permit_type"]

    def walk_factor(lot, ctx):
        metres = haversine(lot["lat"], lot["lng"], ctx["dest_lat"], ctx["dest_lng"])
        mins = walk_minutes(metres)
        lot["_walk"] = mins
        return (normalize(mins, BEST_WALK_MINUTES, WORST_WALK_MINUTES),
                "%d min walk to %s" % (mins, ctx["dest_name"]))

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


def arrive_by(lot, context):
    """Class start minus the walk minus a buffer. The buffer grows when the lot
    is usually full, which is a second honest use of the occupancy data."""
    pct, _ = lot_fullness(lot, context)
    buffer_minutes = BASE_PARKING_BUFFER_MINUTES + round(pct / 100 * 10)
    minutes = context["class_start_minutes"] - lot.get("_walk", 0) - buffer_minutes
    if minutes <= context["now_minutes"]:
        return None
    return minutes_to_time(minutes)


# ---------------------------------------------------------------- spots

def spot_config(context):
    def is_open(spot, ctx):
        if not spot.get("opens_at") or not spot.get("closes_at"):
            return True
        opens = int(spot["opens_at"][:2]) * 60 + int(spot["opens_at"][3:5])
        closes = int(spot["closes_at"][:2]) * 60 + int(spot["closes_at"][3:5])
        return opens <= ctx["now_minutes"] <= closes

    def walk_factor(spot, ctx):
        metres = haversine(spot["lat"], spot["lng"], ctx["dest_lat"], ctx["dest_lng"])
        mins = walk_minutes(metres)
        spot["_walk"] = mins
        if mins <= 1:
            return 1.0, "in the same building as your next class"
        return (normalize(mins, BEST_WALK_MINUTES, WORST_WALK_MINUTES),
                "%d min from %s" % (mins, ctx["dest_name"]))

    def noise_factor(spot, ctx):
        pref = ctx["profile"]["noise_pref"]
        value = 1 - abs(spot["noise_level"] - pref) / 4
        labels = {1: "silent", 2: "quiet", 3: "some background noise", 4: "lively", 5: "loud"}
        return max(0.0, value), labels[spot["noise_level"]]

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
        return event["starts_minutes"] > ctx["now_minutes"] or event["day_offset"] > 0

    def no_class_clash(event, ctx):
        for cls in ctx.get("todays_classes", []):
            if event["day_offset"] == 0 and cls["start"] < event["ends_minutes"] and event["starts_minutes"] < cls["end"]:
                return False
        return True

    def tag_factor(event, ctx):
        mine = set(ctx["profile"]["interests"]) | set(ctx["profile"]["career_goals"])
        theirs = set(event.get("tags", []))
        if not theirs:
            return 0.0, ""
        shared = mine & theirs
        value = len(shared) / max(1, min(len(mine), len(theirs)))
        if not shared:
            return 0.0, ""
        return min(1.0, value), "matches " + " and ".join(sorted(shared))

    def walk_factor(event, ctx):
        metres = haversine(event["lat"], event["lng"], ctx["dest_lat"], ctx["dest_lng"])
        mins = walk_minutes(metres)
        event["_walk"] = mins
        return (normalize(mins, BEST_WALK_MINUTES, WORST_WALK_MINUTES),
                "%d min away" % mins)

    return {
        "filters": [not_started, no_class_clash],
        "factors": {"tags": tag_factor, "walk": walk_factor},
        "weights": EVENT_WEIGHTS,
    }
