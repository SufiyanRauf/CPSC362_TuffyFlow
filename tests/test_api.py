"""The web layer, driven through the app itself.

test_scoring.py reaches past FastAPI and calls the models, the scorer and the
error handler as plain functions. That covers the arithmetic, and it cannot see
the wiring: whether the handler is registered on the app, whether the route is
mounted at the path Vercel forwards, whether a body that fails validation comes
back as a reason or as an empty 500. Deleting the exception_handler decorator
left every one of those 73 tests passing while a real request carrying infinity
turned into a 500, which is the failure the handler exists to stop.

So these go in over HTTP.
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from fastapi.testclient import TestClient

import recommend

client = TestClient(recommend.app)

# The full path, as it is in the app. Vercel hands the original path to the
# function rather than stripping the api prefix, so "/recommend" would be a 404
# in production while passing here if the route were mounted that way.
PATH = "/api/recommend"

CS_LAT, CS_LNG = 33.882349, -117.882750
LIBRARY_LAT, LIBRARY_LNG = 33.881414, -117.885361


def _a_body(**overrides):
    """A Monday morning request of the shape the app sends.

    Monday 10:00 sits inside the 09:00 class, so there is an anchor to measure
    the spot and event walks from, and one row in each list survives its
    filters. A body where everything is filtered out would pass the three key
    assertions below without the scorer having run at all.
    """
    body = {
        "profile": {
            "permit_type": "student",
            "noise_pref": 2,
            "interests": ["ai"],
            "career_goals": ["software-engineering"],
        },
        "dest_lat": CS_LAT,
        "dest_lng": CS_LNG,
        "dest_name": "Computer Science",
        "now_minutes": 600,
        "day_of_week": 1,
        "arrival_hour": 10,
        "class_start_minutes": 690,
        "class_day_offset": 0,
        "lots": [
            {"id": "eastside-south", "name": "Eastside South",
             "lat": 33.880356, "lng": -117.881687,
             "permits": ["student", "employee", "visitor"]},
        ],
        "availability": [
            {"lot_id": "eastside-south", "day_of_week": 1, "hour": 10,
             "typical_pct_full": 62},
        ],
        "spots": [
            {"id": "pl-north-3", "name": "Library North 3rd Floor",
             "lat": LIBRARY_LAT, "lng": LIBRARY_LNG,
             "noise_level": 1, "has_outlets": True,
             "opens_at": "07:00", "closes_at": "23:00"},
        ],
        "events": [
            {"id": "e1", "name": "Resume Workshop", "lat": CS_LAT, "lng": CS_LNG,
             "tags": ["ai"], "starts_minutes": 900, "ends_minutes": 990,
             "day_offset": 0},
        ],
        "class_meetings": [
            {"day_of_week": 1, "start": 540, "end": 615,
             "lat": CS_LAT, "lng": CS_LNG, "building_name": "Computer Science"},
        ],
    }
    body.update(overrides)
    return body


def test_the_health_check_answers_on_the_same_path_as_the_post():
    # Both verbs live at /api/recommend. The deploy check hits the GET, so a
    # route mounted at "/recommend" reads as healthy locally and 404s on Vercel.
    reply = client.get(PATH)
    assert reply.status_code == 200, reply.text
    assert reply.json()["ok"] is True


def test_a_well_formed_request_comes_back_with_the_three_categories():
    reply = client.post(PATH, json=_a_body())
    assert reply.status_code == 200, reply.text
    body = reply.json()
    assert set(body) == {"parking", "spots", "events"}
    assert len(body["parking"]) == 1
    assert len(body["spots"]) == 1
    assert len(body["events"]) == 1


def test_the_parking_result_arrives_over_http_with_its_fullness_and_arrive_by():
    # The route builds these two itself, outside the scorer, so nothing in
    # test_scoring.py's ranking tests touches the version the browser receives.
    reply = client.post(PATH, json=_a_body())
    lot = reply.json()["parking"][0]
    assert lot["id"] == "eastside-south"
    assert lot["pct_full"] == 62
    # Class at 690 minutes, which is 11:30, a 4 minute walk from Eastside South
    # to Computer Science, and a 16 minute buffer because the lot reads 62
    # percent full. Written out rather than recomputed from the constants, as
    # in test_scoring.py: deriving the expected value the way the code does
    # passes even when the constant is wrong.
    assert lot["walk_minutes"] == 4
    assert lot["arrive_by"] == "11:10"
    assert 0 <= lot["match_percent"] <= 100


def test_a_body_carrying_infinity_is_a_422_through_the_app_not_a_500():
    """The one that pins the handler to the app.

    The bounds on the coordinate types turn infinity into a validation error.
    FastAPI's own handler then puts the offending value into the reply, and the
    JSON writer refuses exactly infinity and not-a-number, so it raised inside
    the handler and the caller got a bare 500. Registering explain_bad_request
    on the app is what prevents that, and nothing outside this file can tell
    whether it is registered: calling the function directly passes either way.
    """
    body = _a_body()
    body["dest_lat"] = float("inf")
    # json.dumps writes this as the bare word Infinity, which is what Python
    # and JavaScript encoders both emit. It goes out as text because httpx
    # refuses to encode a non-finite float through json=.
    raw = json.dumps(body)
    assert "Infinity" in raw

    # Without this the TestClient re-raises whatever the handler raised, which
    # hides the status code a real caller would see. A failure here should read
    # as the 500 it is.
    strict = TestClient(recommend.app, raise_server_exceptions=False)
    reply = strict.post(PATH, content=raw,
                        headers={"content-type": "application/json"})

    assert reply.status_code == 422, reply.status_code
    detail = reply.json()["detail"]
    assert ["body", "dest_lat"] in [problem["loc"] for problem in detail]
    assert any("finite" in problem["msg"] for problem in detail), detail


def test_the_reply_to_an_infinity_body_does_not_repeat_the_value():
    # It cannot: a response holding infinity is unrenderable, which is how the
    # 500 happened. Asserting it from the outside is what keeps a later edit
    # from putting the input field back in for the sake of a clearer message.
    body = _a_body()
    body["dest_lng"] = float("-inf")
    strict = TestClient(recommend.app, raise_server_exceptions=False)
    reply = strict.post(PATH, content=json.dumps(body),
                        headers={"content-type": "application/json"})

    assert reply.status_code == 422
    text = reply.text
    assert "Infinity" not in text
    assert "inf" not in text.replace("finite", "")
    assert "input" not in text


def test_not_a_number_and_a_nested_coordinate_go_through_the_same_handler():
    # Two paths the first version of this missed. Not-a-number fails the same
    # bound as infinity and is refused by the JSON writer for the same reason,
    # and a coordinate inside the lots list is validated one level down, so its
    # error carries a list index in the location rather than a plain field name.
    strict = TestClient(recommend.app, raise_server_exceptions=False)

    body = _a_body(dest_lat=float("nan"))
    reply = strict.post(PATH, content=json.dumps(body),
                        headers={"content-type": "application/json"})
    assert reply.status_code == 422, reply.status_code
    assert "NaN" not in reply.text

    body = _a_body()
    body["lots"][0]["lat"] = float("inf")
    reply = strict.post(PATH, content=json.dumps(body),
                        headers={"content-type": "application/json"})
    assert reply.status_code == 422, reply.status_code
    assert ["body", "lots", "0", "lat"] in [p["loc"] for p in reply.json()["detail"]]
    assert "Infinity" not in reply.text


def test_a_body_that_is_not_json_at_all_is_a_422():
    # A truncated body, which is what a dropped connection on a phone leaves
    # behind. It never reaches the model, so it arrives at the handler as a
    # different kind of error, and it still has to come back as a reason.
    for refused in ("{not json at all", ""):
        reply = client.post(PATH, content=refused,
                            headers={"content-type": "application/json"})
        assert reply.status_code == 422, (refused, reply.status_code)
        assert reply.json()["detail"], refused


def test_a_body_that_is_not_an_object_is_a_422():
    # A list, a string and a number all reached the route before the model did
    # anything with them. Pydantic refuses them, and the reply has to come back
    # as a reason rather than as an exception out of model construction.
    for refused in ([1, 2, 3], "recommend please", 7):
        reply = client.post(PATH, json=refused)
        assert reply.status_code == 422, (refused, reply.status_code)
        assert reply.json()["detail"], refused


def test_a_number_outside_its_bounds_is_a_422_with_the_field_named():
    # now_minutes is minutes into the day, so 9999 is not a time. The bound is
    # there so that arithmetic on it never has to cope, and the caller has to
    # be told which field it was.
    reply = client.post(PATH, json=_a_body(now_minutes=9999))
    assert reply.status_code == 422, reply.text
    assert ["body", "now_minutes"] in [p["loc"] for p in reply.json()["detail"]]


def _with_availability(**overrides):
    row = {"lot_id": "eastside-south", "day_of_week": 1, "hour": 10,
           "typical_pct_full": 62}
    row.update(overrides)
    return _a_body(availability=[row])


def _with_event(**overrides):
    row = {"id": "e1", "name": "Resume Workshop", "lat": CS_LAT, "lng": CS_LNG,
           "tags": ["ai"], "starts_minutes": 900, "ends_minutes": 990,
           "day_offset": 0}
    row.update(overrides)
    return _a_body(events=[row])


def _with_meeting(**overrides):
    row = {"day_of_week": 1, "start": 540, "end": 615,
           "lat": CS_LAT, "lng": CS_LNG, "building_name": "Computer Science"}
    row.update(overrides)
    return _a_body(class_meetings=[row])


def test_every_bounded_number_in_the_body_is_a_422_with_the_field_named():
    """now_minutes was the only one of these with a test on it.

    Each of the others is bounded for the same reason and reaches arithmetic
    that assumes the bound holds: a class window ending at 99999 is compared
    against the clock and against every event of the day, an hour of 40 is
    matched against a column that only ever holds 0 to 23, and a lot that is
    300 percent full buys itself a buffer of half an hour. The bounds could all
    be deleted one at a time with the suite still green.
    """
    refused = [
        (["body", "now_minutes"], _a_body(now_minutes=-1)),
        (["body", "now_minutes"], _a_body(now_minutes=1440)),
        (["body", "class_start_minutes"], _a_body(class_start_minutes=-1)),
        (["body", "class_start_minutes"], _a_body(class_start_minutes=1440)),
        (["body", "availability", "0", "hour"], _with_availability(hour=-1)),
        (["body", "availability", "0", "hour"], _with_availability(hour=24)),
        (["body", "availability", "0", "typical_pct_full"],
         _with_availability(typical_pct_full=-1)),
        (["body", "availability", "0", "typical_pct_full"],
         _with_availability(typical_pct_full=101)),
        (["body", "events", "0", "starts_minutes"], _with_event(starts_minutes=-1)),
        (["body", "events", "0", "starts_minutes"], _with_event(starts_minutes=1440)),
        (["body", "events", "0", "ends_minutes"], _with_event(ends_minutes=-1)),
        (["body", "events", "0", "ends_minutes"], _with_event(ends_minutes=1440)),
        (["body", "class_meetings", "0", "start"], _with_meeting(start=-1)),
        (["body", "class_meetings", "0", "start"], _with_meeting(start=1440)),
        (["body", "class_meetings", "0", "end"], _with_meeting(end=-1)),
        (["body", "class_meetings", "0", "end"], _with_meeting(end=1440)),
    ]
    for loc, body in refused:
        reply = client.post(PATH, json=body)
        assert reply.status_code == 422, (loc, reply.status_code)
        assert loc in [p["loc"] for p in reply.json()["detail"]], (loc, reply.text)


def test_an_event_that_has_already_been_is_filtered_rather_than_refused():
    # day_offset is allowed to be negative on purpose, and the field comment
    # says so: a past event is a row we can read, and not_started drops it.
    # Narrowing the field to ge=0 would 422 a body the app really sends, and
    # dropping the branch in not_started would put last week's event on the
    # card, because it starts later in the day than it is now.
    reply = client.post(PATH, json=_a_body(events=[
        {"id": "gone", "name": "Last week", "lat": CS_LAT, "lng": CS_LNG,
         "tags": ["ai"], "starts_minutes": 900, "ends_minutes": 990,
         "day_offset": -7},
    ]))
    assert reply.status_code == 200, reply.text
    assert reply.json()["events"] == []


def test_a_class_later_in_the_week_is_a_request_the_endpoint_accepts():
    # class_day_offset is how many days ahead the next class is, so on a Friday
    # evening it is 3 and the parking ranking reads Monday's occupancy rows.
    # Narrowing the field to le=0 would 422 every request made on any day but
    # the day of the class, which is most of a week.
    reply = client.post(PATH, json=_a_body(day_of_week=5, now_minutes=1200,
                                           class_day_offset=3))
    assert reply.status_code == 200, reply.text
    assert len(reply.json()["parking"]) == 1

    # and the ends of the range still bite, since a week is as far ahead as
    # the next class can ever be
    for refused in (-1, 8):
        reply = client.post(PATH, json=_a_body(class_day_offset=refused))
        assert reply.status_code == 422, (refused, reply.status_code)
        assert ["body", "class_day_offset"] in [p["loc"] for p in reply.json()["detail"]]


def test_the_row_caps_sit_well_above_a_real_campus():
    # The lists are capped so the quadratic part of the scoring is never handed
    # something enormous. Nothing else in either file sends more than one row
    # of anything, so the cap could be dropped to 2 and every request the app
    # makes would be a 422 with the suite still green. The real campus has 24
    # study spots on it.
    spot = _a_body()["spots"][0]
    campus = [dict(spot, id="s%d" % i) for i in range(24)]
    reply = client.post(PATH, json=_a_body(spots=campus))
    assert reply.status_code == 200, reply.text
    # 20 because that is the top_n the route asks for, not because of the cap
    assert len(reply.json()["spots"]) == 20

    flood = [dict(spot, id="s%d" % i) for i in range(recommend.MANY + 1)]
    reply = client.post(PATH, json=_a_body(spots=flood))
    assert reply.status_code == 422, reply.status_code
    assert ["body", "spots"] in [p["loc"] for p in reply.json()["detail"]]


def test_an_empty_campus_is_an_empty_answer_rather_than_an_error():
    # What the first load sends while Firestore is still answering, and what a
    # failed read leaves behind. Three empty lists, not a 500 and not a 422.
    reply = client.post(PATH, json=_a_body(
        lots=[], availability=[], spots=[], events=[], class_meetings=[],
    ))
    assert reply.status_code == 200, reply.text
    assert reply.json() == {"parking": [], "spots": [], "events": []}


def test_a_brand_new_account_posts_successfully_with_nothing_on_its_profile():
    # permit_type and noise_pref are nullable in the database, and the browser
    # writes the nulls out rather than leaving the keys off. This used to be a
    # 422 on a new account's first visit.
    reply = client.post(PATH, json=_a_body(profile={
        "permit_type": None, "noise_pref": None,
        "interests": None, "career_goals": None,
    }))
    assert reply.status_code == 200, reply.text
    body = reply.json()
    # no permit means no lot can be stood behind, which is not an error
    assert body["parking"] == []
    assert len(body["spots"]) == 1
