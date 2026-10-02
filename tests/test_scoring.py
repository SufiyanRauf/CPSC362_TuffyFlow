import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

import scoring


def test_haversine_matches_real_campus_distance():
    # Eastside North to the Computer Science building, from CSUF's own map data.
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
     "permit_type": "student"},
    {"id": "far-empty", "name": "Far and empty", "lat": 33.879029, "lng": -117.888520,
     "permit_type": "student"},
    {"id": "staff-only", "name": "Staff only", "lat": 33.882349, "lng": -117.882800,
     "permit_type": "staff"},
]


def test_permit_is_a_filter_not_a_penalty():
    # The staff lot is the closest and empty. It must not appear at all,
    # because recommending a lot you would be ticketed in is worse than nothing.
    ctx = _parking_context()
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(LOTS, cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
    assert "staff-only" not in [r["item"]["id"] for r in out]


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
        {"id": "a", "name": "Busy", "lat": 33.8823, "lng": -117.8829, "permit_type": "student"},
        {"id": "b", "name": "Quiet", "lat": 33.8823, "lng": -117.8829, "permit_type": "student"},
    ]
    ctx = _parking_context(rows=rows)
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(lots, cfg["filters"], cfg["factors"], cfg["weights"], 10, ctx)
    assert out[0]["item"]["id"] == "b"


def test_missing_availability_does_not_score_as_empty():
    # No row for this hour. The lot must not beat one known to be nearly empty.
    rows = [{"lot_id": "known", "day_of_week": 1, "hour": 10, "typical_pct_full": 10}]
    lots = [
        {"id": "known", "name": "Known quiet", "lat": 33.8823, "lng": -117.8829, "permit_type": "student"},
        {"id": "unknown", "name": "No data", "lat": 33.8823, "lng": -117.8829, "permit_type": "student"},
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
             "permit_type": "student"} for i in range(3)]
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
    ctx = _parking_context()
    cfg = scoring.parking_config(ctx)
    out = scoring.rank(LOTS, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    lot = out[0]["item"]
    assert scoring.arrive_by(lot, ctx, out[0]["walk_minutes"]) is not None


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
        "now_minutes": 600, "todays_classes": [],
    }
    cfg = scoring.event_config(ctx)
    events = [{"id": "e1", "name": "Resume Workshop", "tags": ["career", "software-engineering"],
               "lat": 33.882349, "lng": -117.882750,
               "starts_minutes": 900, "ends_minutes": 990, "day_offset": 0}]
    out = scoring.rank(events, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert out[0]["match_percent"] <= 100


def test_event_clashing_with_a_class_is_filtered_out():
    ctx = {
        "profile": {"interests": ["ai"], "career_goals": [], "permit_type": "student", "noise_pref": 2},
        "dest_lat": 33.882349, "dest_lng": -117.882750, "dest_name": "CS",
        "now_minutes": 600, "todays_classes": [{"start": 890, "end": 970}],
    }
    cfg = scoring.event_config(ctx)
    events = [{"id": "clash", "name": "Clashes", "tags": ["ai"], "lat": 33.8823, "lng": -117.8827,
               "starts_minutes": 900, "ends_minutes": 990, "day_offset": 0}]
    out = scoring.rank(events, cfg["filters"], cfg["factors"], cfg["weights"], 5, ctx)
    assert out == []


def test_spot_in_the_same_building_says_so():
    ctx = {
        "profile": {"noise_pref": 1, "interests": [], "career_goals": [], "permit_type": "student"},
        "dest_lat": 33.881414, "dest_lng": -117.885361, "dest_name": "Pollak Library",
        "now_minutes": 600,
    }
    cfg = scoring.spot_config(ctx)
    spots = [{"id": "s1", "name": "Library North 3rd Floor", "lat": 33.881414, "lng": -117.885361,
              "noise_level": 1, "has_outlets": True, "opens_at": "07:00", "closes_at": "23:00"}]
    out = scoring.rank(spots, cfg["filters"], cfg["factors"], cfg["weights"], 1, ctx)
    assert any("same building" in r for r in out[0]["reasons"])


def test_closed_spot_is_filtered_out():
    ctx = {
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
           "permit_type": "student"}
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
           "permit_type": "student"}
    assert scoring.arrive_by(lot, ctx, 5) is not None
