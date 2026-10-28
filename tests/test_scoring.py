import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

import scoring


def test_haversine_matches_real_campus_distance():
    # Eastside South to the Computer Science building, from CSUF's own map
    # data. South, not North: this said North for a while, which is the exact
    # mix-up the whole lot rebuild was about. North is 166 m from CS and would
    # fail the bounds below; South is 242 m and passes.
    metres = scoring.haversine(33.880356, -117.881687, 33.882349, -117.882750)
    assert 230 < metres < 260, metres


def test_haversine_catches_missing_radians_conversion():
    # Skipping the degrees to radians step inflates this by about 57x.
    metres = scoring.haversine(33.8796, -117.8853, 33.8823, -117.8827)
    assert metres < 1000


def test_walk_minutes_is_a_sensible_campus_walk():
    assert scoring.walk_minutes(240) == 4
    assert scoring.walk_minutes(0) == 0


def test_normalize_lower_is_better():
    assert scoring.normalize(2, 2, 20) == 1.0
    assert scoring.normalize(20, 2, 20) == 0.0
    assert abs(scoring.normalize(11, 2, 20) - 0.5) < 0.01


def test_normalize_clamps_outside_the_anchors():
    assert scoring.normalize(1, 2, 20) == 1.0
    assert scoring.normalize(45, 2, 20) == 0.0


def test_normalize_handles_equal_anchors():
    assert scoring.normalize(5, 5, 5) == 0.5


def _parking_context(hour=10, rows=None, day=1, day_offset=0):
    return {
        "profile": {"permit_type": "student", "noise_pref": 2,
                    "interests": [], "career_goals": []},
        "dest_lat": 33.882349, "dest_lng": -117.882750, "dest_name": "Computer Science",
        "arrival_hour": hour, "availability": rows or [],
        "class_start_minutes": 690, "now_minutes": 600,
        "day_of_week": day, "class_day_offset": day_offset,
    }


LOTS = [
    {"id": "near-empty", "name": "Near and empty", "lat": 33.882349, "lng": -117.882900,
     "permits": ["student"]},
    {"id": "far-empty", "name": "Far and empty", "lat": 33.879029, "lng": -117.888520,
     "permits": ["student"]},
    {"id": "employee-only", "name": "Employee only", "lat": 33.882349, "lng": -117.882800,
     "permits": ["employee"]},
    # three of the four structures really do take three permits at once, so
    # one of these has to
    { "id": "shared", "name": "Takes anything", "lat": 33.879029, "lng": -117.888521,
     "permits": ["student", "employee", "visitor"]},
]


def test_permit_is_a_filter_not_a_penalty():
    # The employee lot is the closest and empty. It must not appear at all,
    # because recommending a lot you would be ticketed in is worse than nothing.
    ctx = _parking_context()
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(LOTS, cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
    assert "employee-only" not in [r["item"]["id"] for r in out]


def test_a_lot_that_takes_several_permits_shows_up_for_each_of_them():
    for permit in ("student", "employee", "visitor"):
        ctx = _parking_context()
        ctx["profile"]["permit_type"] = permit
        cfg = scoring.parking_config(ctx)
        out = scoring.rank(LOTS, cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
        assert "shared" in [r["item"]["id"] for r in out], permit


def test_closer_lot_outranks_further_lot_when_equally_full():
    ctx = _parking_context()
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(LOTS, cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
    assert out[0]["item"]["id"] == "near-empty"


def test_a_full_lot_loses_to_an_emptier_one_at_the_same_distance():
    rows = [
        {"lot_id": "a", "day_of_week": 1, "hour": 10, "typical_pct_full": 95},
        {"lot_id": "b", "day_of_week": 1, "hour": 10, "typical_pct_full": 20},
    ]
    lots = [
        {"id": "a", "name": "Busy", "lat": 33.8823, "lng": -117.8829, "permits": ["student"]},
        {"id": "b", "name": "Quiet", "lat": 33.8823, "lng": -117.8829, "permits": ["student"]},
    ]
    ctx = _parking_context(rows=rows)
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(lots, cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
    assert out[0]["item"]["id"] == "b"


def test_missing_availability_does_not_score_as_empty():
    # No row for this hour. The lot must not beat one known to be nearly empty.
    rows = [{"lot_id": "known", "day_of_week": 1, "hour": 10, "typical_pct_full": 10}]
    lots = [
        {"id": "known", "name": "Known quiet", "lat": 33.8823, "lng": -117.8829, "permits": ["student"]},
        {"id": "unknown", "name": "No data", "lat": 33.8823, "lng": -117.8829, "permits": ["student"]},
    ]
    ctx = _parking_context(rows=rows)
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(lots, cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
    assert out[0]["item"]["id"] == "known"


def test_missing_availability_says_so_in_the_reason():
    ctx = _parking_context(rows=[])
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(LOTS[:1], cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert any("no typical reading" in r for r in out[0]["reasons"])


def test_scores_are_not_all_near_100_on_a_bad_day():
    # Every lot far away and nearly full. Fixed anchors mean the scores stay low
    # rather than the best of a bad set reading as a perfect match.
    rows = [{"lot_id": "f%d" % i, "day_of_week": 1, "hour": 10, "typical_pct_full": 95}
            for i in range(3)]
    lots = [{"id": "f%d" % i, "name": "Far %d" % i, "lat": 33.8700, "lng": -117.8700,
             "permits": ["student"]} for i in range(3)]
    ctx = _parking_context(rows=rows)
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(lots, cfg["filters"], cfg["factors"], cfg["weights"], 3, ctx)
    assert out[0]["match_percent"] < 30


def test_match_percent_is_a_whole_number_0_to_100():
    ctx = _parking_context()
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(LOTS, cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
    for r in out:
        assert isinstance(r["match_percent"], int)
        assert 0 <= r["match_percent"] <= 100


def test_arrive_by_subtracts_walk_and_buffer():
    # Times written out rather than recomputed from the constants, because
    # deriving the expected value the same way the code does passes even when
    # the constant is wrong. Class at 690 minutes, which is 11:30. With no
    # occupancy rows the lot reads as unknown, half full, so the buffer is the
    # base ten plus five.
    ctx = _parking_context()
    lot = {"id": "x", "name": "x", "lat": 33.882349, "lng": -117.882900, "permits": ["student"]}

    assert scoring.arrive_by(lot, ctx, 5) == "11:10"
    # ten minutes further away is ten minutes earlier, and nothing else moves
    assert scoring.arrive_by(lot, ctx, 15) == "11:00"
    # a lot that is usually full buys itself another five minutes
    busy = _parking_context(rows=[{"lot_id": "x", "day_of_week": 1, "hour": 10,
                                   "typical_pct_full": 100}])
    assert scoring.arrive_by(lot, busy, 5) == "11:05"


def test_arrive_by_gives_up_rather_than_wrapping_past_midnight():
    # A walk longer than the time before class used to go negative, and
    # minutes_to_time wraps, so a 09:00 class answered "leave at 16:05".
    ctx = _parking_context(day_offset=1)
    ctx["class_start_minutes"] = 540
    lot = {"id": "x", "name": "x", "lat": 33.882349, "lng": -117.882900, "permits": ["student"]}
    assert scoring.arrive_by(lot, ctx, 1000) is None
    assert scoring.arrive_by(lot, ctx, 5) is not None


def test_haversine_survives_two_points_on_opposite_sides_of_the_planet():
    # a rounds just above 1 here, and sqrt of the negative that leaves used to
    # raise, which came out of the endpoint as a 500 with an empty body.
    metres = scoring.haversine(66.71876003663684, 89.14134013088915,
                               -66.71876003663684, -90.85865986911085)
    assert 19_000_000 < metres < 21_000_000, metres


def test_weight_tables_each_add_up_to_one():
    for name, table in [("parking", scoring.PARKING_WEIGHTS),
                        ("spot", scoring.SPOT_WEIGHTS),
                        ("spot without noise", scoring.SPOT_WEIGHTS_NO_NOISE),
                        ("event", scoring.EVENT_WEIGHTS)]:
        assert abs(sum(table.values()) - 1.0) < 1e-9, name


def test_rank_is_stable_when_everything_ties():
    # Firestore does not promise the order documents come back in, so two
    # candidates alike on score, walk and name have to break on something.
    ctx = _parking_context()
    cfg = scoring.parking_config(ctx)
    same = [{"id": "b", "name": "Same", "lat": 33.882349, "lng": -117.882900, "permits": ["student"]},
            {"id": "a", "name": "Same", "lat": 33.882349, "lng": -117.882900, "permits": ["student"]}]
    forwards = scoring.rank(same, cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
    backwards = scoring.rank(same[::-1], cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
    assert [r["item"]["id"] for r in forwards] == ["a", "b"]
    assert [r["item"]["id"] for r in backwards] == ["a", "b"]


def test_rank_handles_nothing_to_rank_and_honours_top_n():
    ctx = _parking_context()
    cfg = scoring.parking_config(ctx)
    assert scoring.rank([], cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx) == []
    assert len(scoring.rank(LOTS, cfg["filters"], cfg["factors"], cfg["weights"], 2, ctx)) == 2


def test_arrive_by_is_none_when_it_has_already_passed():
    ctx = _parking_context()
    ctx["now_minutes"] = 689          # one minute before class
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(LOTS, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert scoring.arrive_by(out[0]["item"], ctx, out[0]["walk_minutes"]) is None


def test_event_tag_overlap_uses_sets_not_counts():
    # software-engineering appears in both interests and career goals. Counting
    # occurrences instead of unique tags would push this over 1.0.
    ctx = {
        "profile": {"interests": ["software-engineering", "ai"],
                    "career_goals": ["software-engineering", "career"],
                    "permit_type": "student", "noise_pref": 2},
        "dest_lat": 33.882349, "dest_lng": -117.882750, "dest_name": "CS",
        "now_minutes": 600, "day_of_week": 1,
        "class_meetings": [{"day_of_week": 1, "start": 780, "end": 855,
                            "lat": 33.882349, "lng": -117.882750,
                            "building_name": "Computer Science"}],
    }
    cfg = scoring.event_config(ctx)
    events = [{"id": "e1", "name": "Resume Workshop", "tags": ["career", "software-engineering"],
               "lat": 33.882349, "lng": -117.882750,
               "starts_minutes": 900, "ends_minutes": 990, "day_offset": 0}]
    out = scoring.rank(events, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    # both of the event's tags are wanted, so the tag factor is a full 1.0 and
    # the reason names both. Asserting only "<= 100" could never fail.
    assert out[0]["match_percent"] == 100, out[0]
    assert "matches career and software-engineering" in out[0]["reasons"]


def test_event_clashing_with_a_class_is_filtered_out():
    ctx = {
        "profile": {"interests": ["ai"], "career_goals": [], "permit_type": "student", "noise_pref": 2},
        "dest_lat": 33.882349, "dest_lng": -117.882750, "dest_name": "CS",
        "now_minutes": 600, "day_of_week": 1,
        "class_meetings": [{"day_of_week": 1, "start": 890, "end": 970}],
    }
    cfg = scoring.event_config(ctx)
    events = [{"id": "clash", "name": "Clashes", "tags": ["ai"], "lat": 33.8823, "lng": -117.8827,
               "starts_minutes": 900, "ends_minutes": 990, "day_offset": 0}]
    out = scoring.rank(events, cfg["filters"], cfg["factors"], cfg["weights"], 5, ctx)
    assert out == []


def test_a_class_on_a_later_day_still_blocks_an_event():
    # the filter used to look at today only, so anything further out sailed past
    ctx = {
        "profile": {"interests": ["ai"], "career_goals": [], "permit_type": "student", "noise_pref": 2},
        "dest_lat": 33.882349, "dest_lng": -117.882750, "dest_name": "CS",
        "now_minutes": 600, "day_of_week": 1,
        "class_meetings": [{"day_of_week": 3, "start": 890, "end": 970}],
    }
    cfg = scoring.event_config(ctx)
    events = [{"id": "clash", "name": "Two days out", "tags": ["ai"], "lat": 33.8823, "lng": -117.8827,
               "starts_minutes": 900, "ends_minutes": 990, "day_offset": 2}]
    assert scoring.rank(events, cfg["filters"], cfg["factors"], cfg["weights"], 5, ctx) == []


def test_an_event_running_past_midnight_still_clashes_with_a_class():
    # An event that crosses midnight comes back with an end smaller than its
    # start, and "class starts before the event ends" was then false for every
    # class of the day, so the filter let through something the student is
    # sitting in a lecture for.
    ctx = {
        "profile": {"interests": ["ai"], "career_goals": [], "permit_type": "student", "noise_pref": 2},
        "dest_lat": 33.882349, "dest_lng": -117.882750, "dest_name": "CS",
        "now_minutes": 600, "day_of_week": 1,
        "class_meetings": [{"day_of_week": 1, "start": 1350, "end": 1430}],
    }
    cfg = scoring.event_config(ctx)
    overnight = [{"id": "late", "name": "Runs to one in the morning", "tags": ["ai"],
                  "lat": 33.8823, "lng": -117.8827,
                  "starts_minutes": 1320, "ends_minutes": 60, "day_offset": 0}]
    assert scoring.rank(overnight, cfg["filters"], cfg["factors"], cfg["weights"], 5, ctx) == []

    # and a class that is over before it starts does not block it
    ctx["class_meetings"] = [{"day_of_week": 1, "start": 1200, "end": 1260}]
    cfg = scoring.event_config(ctx)
    assert len(scoring.rank(overnight, cfg["filters"], cfg["factors"], cfg["weights"], 5, ctx)) == 1


def test_sooner_always_scores_at_least_as_well():
    ctx = {
        "profile": {"interests": [], "career_goals": [], "permit_type": "student", "noise_pref": 2},
        "dest_lat": 33.882349, "dest_lng": -117.882750, "dest_name": "CS",
        "now_minutes": 600, "day_of_week": 1, "class_meetings": [],
    }
    cfg = scoring.event_config(ctx)
    scores = []
    for day in range(0, 6):
        e = {"id": "e", "name": "E", "tags": [], "lat": 33.882349, "lng": -117.882750,
             "starts_minutes": 900, "ends_minutes": 990, "day_offset": day}
        out = scoring.rank([e], cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
        scores.append(out[0]["match_percent"])
    assert scores == sorted(scores, reverse=True), scores


def test_a_quieter_spot_is_never_worse_than_a_louder_one():
    # noise_pref is a ceiling in the interface, so silence must not be penalized
    ctx = {
        "profile": {"interests": [], "career_goals": [], "permit_type": "student", "noise_pref": 3},
        "dest_lat": 33.882349, "dest_lng": -117.882750, "dest_name": "CS",
        "now_minutes": 600, "day_of_week": 1, "arrival_hour": 10,
    }
    cfg = scoring.spot_config(ctx)
    spots = [
        {"id": "silent", "name": "Silent", "lat": 33.882349, "lng": -117.882750,
         "noise_level": 1, "has_outlets": True},
        {"id": "loud", "name": "Loud", "lat": 33.882349, "lng": -117.882750,
         "noise_level": 5, "has_outlets": True},
    ]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 2, ctx)
    assert out[0]["item"]["id"] == "silent", [(r["item"]["id"], r["match_percent"]) for r in out]


def test_spot_in_the_building_you_are_already_in_says_so():
    ctx = {
        "profile": {"noise_pref": 1, "interests": [], "career_goals": [], "permit_type": "student"},
        "dest_lat": 33.881414, "dest_lng": -117.885361, "dest_name": "Pollak Library",
        "now_minutes": 600, "day_of_week": 1,
        "class_meetings": [{"day_of_week": 1, "start": 540, "end": 615,
                            "lat": 33.881414, "lng": -117.885361,
                            "building_name": "Pollak Library"}],
    }
    cfg = scoring.spot_config(ctx)
    spots = [{"id": "s1", "name": "Library North 3rd Floor", "lat": 33.881414, "lng": -117.885361,
              "noise_level": 1, "has_outlets": True, "opens_at": "07:00", "closes_at": "23:00"}]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert any("right by Pollak Library" in r for r in out[0]["reasons"])


def test_closed_spot_is_filtered_out():
    ctx = {
        "day_of_week": 1,
        "profile": {"noise_pref": 2, "interests": [], "career_goals": [], "permit_type": "student"},
        "dest_lat": 33.8814, "dest_lng": -117.8853, "dest_name": "PL",
        "now_minutes": 1380,                      # 11pm
    }
    cfg = scoring.spot_config(ctx)
    spots = [{"id": "shut", "name": "Food place", "lat": 33.8814, "lng": -117.8853,
              "noise_level": 4, "has_outlets": False, "opens_at": "10:00", "closes_at": "17:00"}]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 5, ctx)
    assert out == []


def test_fullness_reads_the_class_day_not_today():
    # Asked on a Friday about a Monday class. Monday's row is the one that counts.
    rows = [
        {"lot_id": "a", "day_of_week": 5, "hour": 10, "typical_pct_full": 5},
        {"lot_id": "a", "day_of_week": 1, "hour": 10, "typical_pct_full": 95},
    ]
    lot = {"id": "a", "name": "A", "lat": 33.8823, "lng": -117.8829,
           "permits": ["student"]}
    ctx = _parking_context(rows=rows, day=5, day_offset=3)
    assert scoring.lot_fullness(lot, ctx) == (95, True)


def test_class_day_wraps_past_saturday():
    ctx = _parking_context(day=6, day_offset=2)
    assert scoring.class_day(ctx) == 1


def test_arrive_by_stands_for_a_class_on_another_day():
    # The time has passed today, but the class is tomorrow, so it still holds.
    ctx = _parking_context(day_offset=1)
    ctx["now_minutes"] = 1400
    lot = {"id": "a", "name": "A", "lat": 33.8823, "lng": -117.8829,
           "permits": ["student"]}
    assert scoring.arrive_by(lot, ctx, 5) is not None


# ---------------------------------------------------------------- the anchor
#
# Everything used to be measured from the building of the next class. For
# parking that is right, you are parking for that class. For a study spot you
# want now, or an event three days out, it measured a walk nobody was about to
# take. These pin the day each walk is measured from.

FRIDAY, SATURDAY, MONDAY = 5, 6, 1

# far apart on purpose: about 650 m, which is an 11 minute walk
CS_LAT, CS_LNG = 33.882349, -117.882750
NUTWOOD_LAT, NUTWOOD_LNG = 33.879051, -117.888524


def _week_context(day, minutes):
    return {
        "profile": {"interests": ["ai"], "career_goals": [], "noise_pref": 3,
                    "permit_type": "student"},
        # the next class is Monday in Computer Science, which is what the old
        # code measured everything against
        "dest_lat": CS_LAT, "dest_lng": CS_LNG, "dest_name": "Computer Science",
        "now_minutes": minutes, "day_of_week": day,
        "class_meetings": [
            {"day_of_week": MONDAY, "start": 540, "end": 615,
             "lat": CS_LAT, "lng": CS_LNG, "building_name": "Computer Science"},
            {"day_of_week": FRIDAY, "start": 960, "end": 1035,
             "lat": NUTWOOD_LAT, "lng": NUTWOOD_LNG, "building_name": "Titan Hall"},
        ],
    }


def test_spot_walk_is_measured_from_todays_class_not_the_next_one():
    # Friday 16:30, sitting in the Friday class. A spot in that building is a
    # nothing walk. Measured from Monday's lecture it would read as 11 minutes.
    ctx = _week_context(FRIDAY, 990)
    cfg = scoring.spot_config(ctx)
    spots = [{"id": "near", "name": "Next door", "lat": NUTWOOD_LAT, "lng": NUTWOOD_LNG,
              "noise_level": 2, "has_outlets": True, "opens_at": "07:00", "closes_at": "23:00"}]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert out[0]["walk_minutes"] == 0
    assert any("Titan Hall" in r for r in out[0]["reasons"])


def test_event_walk_is_measured_from_its_own_day():
    # A Saturday event next to the Computer Science building. There is no class
    # on Saturday, so nothing says where the student would be, and the card has
    # to admit that rather than quietly measuring from Monday.
    ctx = _week_context(FRIDAY, 990)
    cfg = scoring.event_config(ctx)
    events = [{"id": "e", "name": "Hack night", "tags": ["ai"],
               "lat": CS_LAT, "lng": CS_LNG,
               "starts_minutes": 1080, "ends_minutes": 1200, "day_offset": 1}]
    out = scoring.rank(events, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert out[0]["walk_minutes"] is None
    assert any("no class that day" in r for r in out[0]["reasons"]), out[0]["reasons"]


def test_a_day_with_no_classes_has_no_anchor():
    assert scoring.anchor_for(_week_context(FRIDAY, 990), SATURDAY, 600) is None


def test_a_class_hours_away_does_not_anchor_the_evening():
    # the 16:00 Friday class does not say where anyone is at 22:00
    ctx = _week_context(FRIDAY, 1320)
    assert scoring.anchor_for(ctx, FRIDAY, 1320) is None
    # but an hour after it ends, it still does
    assert scoring.anchor_for(ctx, FRIDAY, 1095)[2] == "Titan Hall"


def test_tie_break_prefers_the_class_still_to_come():
    # two classes the same distance away in time, one over, one upcoming
    ctx = _week_context(MONDAY, 600)
    ctx["class_meetings"] = [
        {"day_of_week": MONDAY, "start": 450, "end": 540,
         "lat": CS_LAT, "lng": CS_LNG, "building_name": "Already finished"},
        {"day_of_week": MONDAY, "start": 660, "end": 720,
         "lat": NUTWOOD_LAT, "lng": NUTWOOD_LNG, "building_name": "Still to come"},
    ]
    assert scoring.anchor_for(ctx, MONDAY, 600)[2] == "Still to come"
    # and the answer does not depend on the order the schedule arrives in
    ctx["class_meetings"].reverse()
    assert scoring.anchor_for(ctx, MONDAY, 600)[2] == "Still to come"


def test_anchor_picks_the_class_nearest_in_time():
    ctx = _week_context(MONDAY, 600)
    ctx["class_meetings"].append(
        {"day_of_week": MONDAY, "start": 1020, "end": 1095,
         "lat": NUTWOOD_LAT, "lng": NUTWOOD_LNG, "building_name": "Titan Hall"})
    # 10:00 is inside the 09:00 class, so that one wins over the 17:00 one
    assert scoring.anchor_for(ctx, MONDAY, 600)[2] == "Computer Science"
    # by 16:00 the later class is the nearer of the two
    assert scoring.anchor_for(ctx, MONDAY, 960)[2] == "Titan Hall"


def test_parking_still_measures_from_the_next_class():
    # the one place the old behavior was correct, so it must not have changed
    ctx = _week_context(FRIDAY, 990)
    ctx.update({"arrival_hour": 8, "class_start_minutes": 540, "class_day_offset": 3,
                "availability": []})
    cfg = scoring.parking_config(ctx)
    lots = [{"id": "far", "name": "Far", "lat": NUTWOOD_LAT, "lng": NUTWOOD_LNG,
             "permits": ["student"]}]
    out = scoring.rank(lots, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert any("Computer Science" in r for r in out[0]["reasons"]), out[0]["reasons"]


def test_the_walk_reason_does_not_repeat_the_number():
    # the card prints "4 min walk" on its own row, so a reason carrying the
    # number too made it read "4 min walk / 4 min from Humanities"
    ctx = _week_context(FRIDAY, 990)
    cfg = scoring.spot_config(ctx)
    spots = [{"id": "far", "name": "Across campus", "lat": CS_LAT, "lng": CS_LNG,
              "noise_level": 2, "has_outlets": True, "opens_at": "07:00", "closes_at": "23:59"}]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert out[0]["walk_minutes"] == 11
    assert "measured from Titan Hall" in out[0]["reasons"]
    assert not any("min" in r for r in out[0]["reasons"]), out[0]["reasons"]


# ------------------------------------------------- a profile with gaps in it
#
# Sign in brought accounts, and a brand new account knows almost nothing about
# the person. profiles.permit_type and profiles.noise_pref are nullable for
# that reason, so the scorer has to be able to say "not known".
#
# The two halves were in different states. A missing permit already matched no
# lot, because None is not in any lot's list, so that part only needed saying
# out loud. A missing noise preference crashed on comparing an int to None, and
# then, once it stopped crashing, quietly cost every spot about twenty points.
# The tests that matter here are the noise ones.

def _empty_profile_context(day=MONDAY, minutes=600):
    return {
        "profile": {"permit_type": None, "noise_pref": None,
                    "interests": [], "career_goals": []},
        "dest_lat": CS_LAT, "dest_lng": CS_LNG, "dest_name": "Computer Science",
        "now_minutes": minutes, "day_of_week": day, "arrival_hour": 10,
        "class_start_minutes": 690, "availability": [],
        "class_meetings": [{"day_of_week": MONDAY, "start": 540, "end": 615,
                            "lat": CS_LAT, "lng": CS_LNG,
                            "building_name": "Computer Science"}],
    }


def test_no_permit_means_no_lot_is_recommended():
    # Not a bug. Every lot takes some permits and not others, so without
    # knowing which one you hold there is no lot we can stand behind.
    ctx = _empty_profile_context()
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(LOTS, cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
    assert out == []


def test_an_unset_noise_preference_does_not_order_the_spots():
    # Two spots alike but for how loud they are. With no preference on the
    # profile, noise must not decide between them.
    ctx = _empty_profile_context()
    cfg = scoring.spot_config(ctx)
    spots = [
        {"id": "silent", "name": "Silent", "lat": CS_LAT, "lng": CS_LNG,
         "noise_level": 1, "has_outlets": True},
        {"id": "loud", "name": "Loud", "lat": CS_LAT, "lng": CS_LNG,
         "noise_level": 5, "has_outlets": True},
    ]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 2, ctx)
    assert len(out) == 2
    assert out[0]["match_percent"] == out[1]["match_percent"]


def test_an_unset_noise_preference_still_says_how_loud_the_spot_is():
    # How loud somewhere is is a fact about the place. It is worth reading
    # whether or not we know what the person asked for.
    ctx = _empty_profile_context()
    cfg = scoring.spot_config(ctx)
    spots = [{"id": "silent", "name": "Quiet floor", "lat": CS_LAT, "lng": CS_LNG,
              "noise_level": 1, "has_outlets": True}]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert "silent" in out[0]["reasons"]


def test_events_still_rank_for_a_profile_with_no_interests():
    # Nothing matches the tags, so tags score zero, but the event should still
    # come back: how soon it is and how far it is are worth something on their own.
    ctx = _empty_profile_context()
    cfg = scoring.event_config(ctx)
    events = [{"id": "e1", "name": "Open Mic Night", "lat": CS_LAT, "lng": CS_LNG,
               "tags": ["music"], "starts_minutes": 1140, "ends_minutes": 1260,
               "day_offset": 0}]
    out = scoring.rank(events, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert len(out) == 1
    assert 0 < out[0]["match_percent"] < 100


def test_the_request_model_takes_a_profile_with_nothing_filled_in():
    # The web layer used to reject this with a 422, which is what a new account
    # would have sent on its first visit.
    import recommend

    profile = recommend.Profile()
    assert profile.permit_type is None
    assert profile.noise_pref is None
    assert profile.interests == []


def test_an_unset_noise_preference_does_not_cost_a_spot_anything():
    """The first fix scored the missing preference at the midpoint, on the
    reasoning that half of nothing is neutral. It is not: noise is a ceiling,
    so a stated preference scores a full mark for every spot at or under it,
    and half is the bottom of the range that comes up rather than the middle.
    A perfect spot read 80 percent for a new account and 100 for everyone else.
    """
    spot = [{"id": "s", "name": "Quiet corner", "lat": CS_LAT, "lng": CS_LNG,
             "noise_level": 1, "has_outlets": True}]

    unset = _empty_profile_context()
    cfg = scoring.spot_config(unset)
    without = scoring.rank(spot, cfg["filters"], cfg["factors"], cfg["weights"], 1, unset)

    stated = _empty_profile_context()
    stated["profile"]["noise_pref"] = 1
    cfg = scoring.spot_config(stated)
    with_pref = scoring.rank(spot, cfg["filters"], cfg["factors"], cfg["weights"], 1, stated)

    assert without[0]["match_percent"] == with_pref[0]["match_percent"] == 100


def test_an_unset_noise_preference_does_not_hand_the_ranking_to_outlets():
    # The midpoint version did. A loud spot with sockets beat a silent one
    # without, which is noise losing to a factor of half its weight.
    ctx = _empty_profile_context()
    cfg = scoring.spot_config(ctx)
    spots = [
        {"id": "silent", "name": "Silent", "lat": CS_LAT, "lng": CS_LNG,
         "noise_level": 1, "has_outlets": False},
        {"id": "loud", "name": "Loud", "lat": CS_LAT, "lng": CS_LNG,
         "noise_level": 5, "has_outlets": True},
    ]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 2, ctx)
    scores = {r["item"]["id"]: r["match_percent"] for r in out}
    # outlets still counts for something, so the one with sockets is ahead.
    # What must not happen is noise dragging the silent one down as well.
    assert scores["silent"] == 67, scores
    assert scores["loud"] == 100, scores


def test_the_noise_bounds_still_bite_when_a_preference_is_given():
    # Widening the field to accept null is one edit away from dropping the
    # range check with it, and a noise_pref of 99 would sail through into
    # 1 - (level - 99) / 4.
    import pydantic
    import recommend

    for refused in (0, 6):
        try:
            recommend.Profile(noise_pref=refused)
        except pydantic.ValidationError:
            continue
        raise AssertionError("noise_pref=%d should not validate" % refused)
    assert recommend.Profile(noise_pref=3).noise_pref == 3


def test_the_model_takes_an_explicit_null_and_not_just_a_missing_key():
    # What the browser actually sends. JSON.stringify writes the nulls out
    # rather than leaving the keys off, so "missing" was never the case under
    # test.
    import recommend

    profile = recommend.Profile(
        permit_type=None, noise_pref=None, interests=None, career_goals=None,
    )
    assert profile.permit_type is None
    assert profile.noise_pref is None
    assert profile.interests == [] and profile.career_goals == []


def test_a_permit_that_is_not_one_of_the_four_is_refused():
    # Otherwise a typo arrives as an empty parking screen, which is also what a
    # missing permit looks like, and the two want different explanations.
    import pydantic
    import recommend

    try:
        recommend.Profile(permit_type="staff")
    except pydantic.ValidationError:
        return
    raise AssertionError("permit_type=staff should not validate")


def test_the_parking_result_carries_the_fullness_as_a_number():
    # The parking screen draws a bar from this. It used to recover the figure
    # by stripping the non-digits out of the reason sentence, which worked
    # only while that sentence held exactly one number.
    import recommend

    ctx = _parking_context(hour=10, rows=[
        {"lot_id": "near-empty", "day_of_week": 1, "hour": 10, "typical_pct_full": 41},
    ])
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(LOTS, cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
    results = {r["item"]["id"]: recommend._result(r, "parking", True, ctx) for r in out}

    assert results["near-empty"]["pct_full"] == 41
    # and None, not the stand-in the scoring uses, where there is no reading
    assert results["far-empty"]["pct_full"] is None


def test_only_parking_carries_a_fullness():
    # a study spot has no such thing, and a number there would be meaningless
    import recommend

    ctx = _empty_profile_context()
    ctx["profile"]["noise_pref"] = 2
    cfg = scoring.spot_config(ctx)
    spots = [{"id": "s", "name": "S", "lat": CS_LAT, "lng": CS_LNG,
              "noise_level": 1, "has_outlets": True}]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert recommend._result(out[0], "spot")["pct_full"] is None


# ---------------------------------------------- a request from somewhere else
#
# The scoring endpoint has no sign in of its own, so anything on the internet
# can post to it. None of these can come from our own screens. They are here
# because each one used to be a 500 out of the arithmetic rather than a 422
# with a reason, and a 500 is the app's fault however it was provoked.

def _a_spot(**overrides):
    spot = {"id": "s", "name": "S", "lat": 33.88, "lng": -117.88,
            "noise_level": 1, "has_outlets": True}
    spot.update(overrides)
    return spot


def test_a_time_that_is_not_a_time_is_refused():
    import pydantic
    import recommend

    for refused in ("9:00", "not a time", "08", "24:00", "07:60"):
        try:
            recommend.Spot(**_a_spot(opens_at=refused))
        except pydantic.ValidationError:
            continue
        raise AssertionError("opens_at=%r should not validate" % refused)

    # both forms Postgres and the sample rows actually produce
    assert recommend.Spot(**_a_spot(opens_at="07:00")).opens_at == "07:00"
    assert recommend.Spot(**_a_spot(opens_at="07:00:00")).opens_at == "07:00:00"


def test_empty_hours_and_missing_hours_mean_the_same_thing():
    # They used to take opposite paths: one skipped the open check, the other
    # was parsed and raised.
    import recommend

    assert recommend.Spot(**_a_spot(opens_at="")).opens_at is None
    assert recommend.Spot(**_a_spot()).opens_at is None


def test_a_coordinate_that_is_not_on_earth_is_refused():
    import pydantic
    import recommend

    for refused in (float("inf"), float("-inf"), float("nan"), 91.0, -91.0):
        try:
            recommend.Spot(**_a_spot(lat=refused))
        except pydantic.ValidationError:
            continue
        raise AssertionError("lat=%r should not validate" % refused)
    assert recommend.Spot(**_a_spot(lat=33.88)).lat == 33.88


def test_a_factor_that_returns_not_a_number_scores_zero_not_a_perfect_match():
    # max(0.0, min(1.0, nan)) is 1.0 in Python, so the clamp used to turn a
    # broken factor into a 100 percent match.
    def broken(_item, _ctx):
        return float("nan"), ""

    out = scoring.rank([{"id": "x", "name": "X"}], [], {"only": broken}, {"only": 1.0}, 1, {})
    assert out[0]["match_percent"] == 0


def test_a_body_with_infinity_in_it_gets_a_reason_not_a_crash():
    """Bounding the coordinates was not enough on its own.

    The check fired, and then the default handler put the offending value into
    the reply, where the JSON writer refuses exactly infinity and not-a-number
    and raised inside the handler. The caller got a bare 500 with nothing in
    it, which is what the bounds were added to prevent.
    """
    import recommend
    from fastapi.exceptions import RequestValidationError

    problem = RequestValidationError([
        {"loc": ("body", "dest_lat"), "msg": "Input should be a finite number",
         "type": "finite_number", "input": float("inf")},
    ])
    reply = recommend.explain_bad_request(None, problem)
    assert reply.status_code == 422
    # it has to be renderable, which is the whole point
    body = reply.body.decode()
    assert "dest_lat" in body
    assert "finite" in body
    # and the value itself never goes back out
    assert "Infinity" not in body and "inf" not in body.replace("finite", "")


# ------------------------------------------------------ open on the day, too
#
# is_open only ever looked at the clock. Nearly every food place on this campus
# publishes Monday to Thursday hours and nothing else, so on a Saturday the app
# offered fifteen of the sixteen of them, with a match score, while the hours
# printed on the same card said they were shut.

def _spots_context(now_minutes=720):
    ctx = _empty_profile_context()
    ctx["profile"]["noise_pref"] = 3
    ctx["now_minutes"] = now_minutes
    return ctx


def test_somewhere_shut_today_is_not_recommended_whatever_the_clock_says():
    ctx = _spots_context(now_minutes=720)          # noon, inside its weekday hours
    cfg = scoring.spot_config(ctx)
    spots = [{"id": "weekday-only", "name": "Panda Express", "lat": CS_LAT, "lng": CS_LNG,
              "noise_level": 3, "has_outlets": False,
              # the caller resolved the day already and found nothing for it
              "opens_at": None, "closes_at": None, "closed_today": True}]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 5, ctx)
    assert out == []


def test_hours_we_never_knew_are_not_a_reason_to_rule_somewhere_out():
    # The two cases have to stay apart: shut today is a fact, no hours on file
    # is an absence, and only one of them is a reason to hide a place.
    ctx = _spots_context()
    cfg = scoring.spot_config(ctx)
    spots = [{"id": "unknown", "name": "Somewhere", "lat": CS_LAT, "lng": CS_LNG,
              "noise_level": 3, "has_outlets": False,
              "opens_at": None, "closes_at": None, "closed_today": False}]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 5, ctx)
    assert len(out) == 1


def test_open_today_still_gets_checked_against_the_clock():
    spot = {"id": "s", "name": "Fresh Kitchen", "lat": CS_LAT, "lng": CS_LNG,
            "noise_level": 3, "has_outlets": False,
            "opens_at": "10:00", "closes_at": "15:00", "closed_today": False}

    inside = _spots_context(now_minutes=720)        # 12:00
    cfg = scoring.spot_config(inside)
    assert len(scoring.rank([spot], cfg["filters"], cfg["factors"], cfg["weights"], 5, inside)) == 1

    after = _spots_context(now_minutes=1020)        # 17:00
    cfg = scoring.spot_config(after)
    assert scoring.rank([spot], cfg["filters"], cfg["factors"], cfg["weights"], 5, after) == []


def test_the_request_model_defaults_closed_today_to_false():
    # Everything that was sending spots before this field existed still means
    # "I have not told you, so do not rule it out".
    import recommend

    assert recommend.Spot(id="s", name="S", lat=33.88, lng=-117.88,
                          noise_level=1, has_outlets=True).closed_today is False


def test_the_published_hours_line_up_with_what_the_app_can_offer():
    """A guard on the data rather than on the code.

    The per day hours were derived from each spot's published note by a
    script, and a script that is quietly wrong is invisible: every row looks
    plausible and the app is confidently closed, or confidently open, on the
    wrong day. These counts come from reading the notes by hand, so if the
    data drifts from them somebody has to come and look.

    The one row the script could not derive, the library's group study rooms,
    is exactly where the first attempt went wrong, which is why Sunday and
    Saturday are pinned here.
    """
    import json
    import subprocess

    here = os.path.dirname(__file__)
    root = os.path.join(here, "..")
    # Node reads the TypeScript directly, so the test sees the same rows the
    # app does rather than a copy that can fall behind.
    out = subprocess.run(
        ["node", "--input-type=module", "-e", """
          import { spots } from './src/lib/campusRows.ts';
          const open = [];
          for (let d = 0; d < 7; d++) {
            open.push(spots.filter(s => Object.keys(s.hours).length === 0 || s.hours[d]).length);
          }
          const food = [];
          for (let d = 0; d < 7; d++) {
            food.push(spots.filter(s => s.kind === 'eat' && s.hours[d]).length);
          }
          // Nothing in Pollak can be open when the library floors are not.
          // The floors are the building's published hours; anything else in
          // there is a room inside it.
          const floors = spots.filter(s => s.name.startsWith('Library '));
          const others = spots.filter(s => s.building_id === 'b-pl' && !s.name.startsWith('Library '));
          const insideTheLibrary = [];
          for (const s of others) {
            for (let d = 0; d < 7; d++) {
              const mine = s.hours[d];
              if (!mine) continue;
              const building = floors[0].hours[d];
              if (!building) { insideTheLibrary.push(s.name + ' day ' + d + ': building shut'); continue; }
              if (mine[0] < building[0] || mine[1] > building[1]) {
                insideTheLibrary.push(s.name + ' day ' + d + ': ' + mine.join('-') + ' vs ' + building.join('-'));
              }
            }
          }
          console.log(JSON.stringify({ open, food, total: spots.length, insideTheLibrary }));
        """],
        cwd=root, capture_output=True, text=True,
    )
    assert out.returncode == 0, out.stderr
    counts = json.loads(out.stdout.strip().splitlines()[-1])

    assert counts["total"] == 24
    #                     Sun Mon Tue Wed Thu Fri Sat
    assert counts["open"] == [7, 24, 24, 24, 24, 21, 9], counts["open"]
    # The Express at Titan Shops is the only food place open on a Saturday,
    # and nowhere serves food on a Sunday.
    assert counts["food"] == [0, 16, 16, 16, 16, 13, 1], counts["food"]

    # Counting the days is not enough on its own, which is worth knowing: the
    # first version of this test counted them, and the bug it was written for
    # put the group study rooms back to seven days at seven in the morning
    # until eleven at night. The day count never moved, because the rooms are
    # open on a Sunday either way. It is the hours that were wrong.
    inside = counts["insideTheLibrary"]
    assert inside == [], (
        "These are open when the library around them is shut: %s" % inside
    )
