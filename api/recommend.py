import os
import re
import sys

from typing import Annotated, Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

# Vercel runs this from /var/task with api/ not on the path, so scoring is not
# importable by name there even though it sits next to this file.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scoring import (
    arrive_by, event_config, lot_fullness, parking_config, rank, spot_config,
)

app = FastAPI()


@app.exception_handler(RequestValidationError)
def explain_bad_request(_request: Request, error: RequestValidationError) -> JSONResponse:
    """Say what was wrong with the body without quoting it back.

    Bounding the coordinates was supposed to turn infinity and not-a-number
    into a 422. It did not: the check fired, and then the default handler put
    the offending value into the response, where the JSON writer refuses
    exactly those two and raised inside the handler itself. The caller got a
    bare 500 with no reason, which is the thing the bounds were added to stop,
    moved one layer out.

    So the reply carries where, what and why, and never the value.
    """
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {
                    "loc": [str(part) for part in problem.get("loc", ())],
                    "msg": str(problem.get("msg", "")),
                    "type": str(problem.get("type", "")),
                }
                for problem in error.errors()
            ],
        },
    )


# This endpoint has no sign in of its own, so anything on the internet can post
# to it. The bounds below are not about our own screens, which cannot produce a
# bad value: they are so that a stray request is a 422 with a reason rather
# than a 500 out of the arithmetic. Pydantic rejects infinity and not-a-number here
# too, because every comparison against those is false.
Latitude = Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
Longitude = Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]

# "07:00" or "07:00:00". The profile screen writes the padded form and the
# sample rows use the short one; anything else used to reach int("9:") and 500.
A_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$")

# Room for every row the app can hold several times over. A body is capped at
# 4.5 MB by the host either way; this stops the quadratic part of the scoring
# being handed a list big enough to matter.
MANY = 2000

# How many of each category the route asks the scorer for. One number because
# the three screens read the same way, and a named one because 20 on its own in
# three calls looks like three unrelated decisions.
TOP_N = 20


# Full path, not "/recommend". Vercel passes the original path through to the app.
@app.get("/api/recommend")
def health() -> dict:
    return {"ok": True, "status": "healthy"}


class Profile(BaseModel):
    # The first two are nullable because profiles.permit_type and
    # profiles.noise_pref are. A brand new account has only what signup could
    # ask for, and the scorer treats not knowing as not knowing rather than as
    # a default.
    #
    # permit_type is the same four values as the check constraint in
    # db/schema.sql and the union in src/types.ts. Spelling them out here as
    # well is what stops a typo in a fifth value arriving as "no lot matches",
    # which is also what a missing permit looks like.
    permit_type: Literal["student", "employee", "resident", "visitor"] | None = None
    noise_pref: int | None = Field(default=None, ge=1, le=5)
    # The columns behind these two are not null, so the app always sends a
    # list. The validator is for every other caller: leaving the field out was
    # already fine and sending null was a 422, which is a difference nobody
    # would expect and the same failure this model was just widened to avoid.
    interests: list[str] = []
    career_goals: list[str] = []

    @field_validator("interests", "career_goals", mode="before")
    @classmethod
    def _null_is_empty(cls, value):
        return [] if value is None else value


class Lot(BaseModel):
    id: str
    name: str
    lat: Latitude
    lng: Longitude
    # A lot can take more than one. Three of the four structures take
    # student, employee and hourly permits all at once.
    permits: list[str]


class Availability(BaseModel):
    lot_id: str
    day_of_week: int = Field(ge=0, le=6)
    hour: int = Field(ge=0, le=23)
    typical_pct_full: int = Field(ge=0, le=100)


class Spot(BaseModel):
    id: str
    name: str
    kind: str | None = None
    lat: Latitude
    lng: Longitude
    noise_level: int = Field(ge=1, le=5)
    has_outlets: bool
    opens_at: str | None = None
    closes_at: str | None = None
    # Shut today, as opposed to open today or hours unknown. The caller works
    # out which day it is and sends that day's times, so the scorer still only
    # ever handles one pair.
    closed_today: bool = False

    @field_validator("opens_at", "closes_at", mode="before")
    @classmethod
    def _a_real_time(cls, value):
        # Empty and missing both mean "we do not know the hours", which the
        # scorer treats as open. They used to take different paths: one was
        # skipped and the other was parsed and crashed.
        if value is None or value == "":
            return None
        if not isinstance(value, str) or not A_TIME.match(value):
            raise ValueError("expected a time like 07:00 or 07:00:00")
        return value


class Event(BaseModel):
    id: str
    name: str
    lat: Latitude
    lng: Longitude
    tags: list[str]
    starts_minutes: int = Field(ge=0, le=1439)
    ends_minutes: int = Field(ge=0, le=1439)
    # negative is meaningful: it is an event that has already been and
    # gone, which not_started filters out rather than rejecting here.
    day_offset: int = Field(ge=-366, le=366)


class ClassWindow(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start: int = Field(ge=0, le=1439)
    end: int = Field(ge=0, le=1439)
    # where the class is, so a walk can be measured from the right place on
    # the right day. Optional because a clash check does not need it.
    lat: Latitude | None = None
    lng: Longitude | None = None
    building_name: str | None = None


class RecommendRequest(BaseModel):
    profile: Profile
    dest_lat: Latitude
    dest_lng: Longitude
    dest_name: str
    now_minutes: int = Field(ge=0, le=1439)
    day_of_week: int = Field(ge=0, le=6)
    arrival_hour: int = Field(ge=0, le=23)
    class_start_minutes: int = Field(ge=0, le=1439)
    class_day_offset: int = Field(default=0, ge=0, le=7)
    lots: list[Lot] = Field(max_length=MANY)
    availability: list[Availability] = Field(max_length=MANY)
    spots: list[Spot] = Field(max_length=MANY)
    events: list[Event] = Field(max_length=MANY)
    class_meetings: list[ClassWindow] = Field(default=[], max_length=MANY)


def _result(entry, category, with_parking_fields=False, context=None):
    """One card's worth of JSON. The flag turns on the two fields only a lot
    has, which are the fullness percentage and the time to leave by."""
    item = entry["item"]
    walk = entry.get("walk_minutes")
    # Parking only, and None where there is no reading for that hour rather
    # than the stand-in the scoring uses. The parking screen draws a bar from
    # this and used to recover it by stripping the non-digits out of the
    # reason sentence, which held only as long as that sentence contained
    # exactly one number.
    pct, known = lot_fullness(item, context) if with_parking_fields else (None, False)
    return {
        "id": item["id"],
        "category": category,
        "title": item["name"],
        "match_percent": entry["match_percent"],
        "reasons": entry["reasons"],
        "lat": item.get("lat"),
        "lng": item.get("lng"),
        "kind": item.get("kind"),
        "walk_minutes": walk,
        "pct_full": pct if known else None,
        "arrive_by": arrive_by(item, context, walk) if with_parking_fields else None,
    }


@app.post("/api/recommend")
def recommend(body: RecommendRequest) -> dict:
    # model_dump is recursive, so profile is already a plain dict in here.
    context = body.model_dump()

    parking = parking_config(context)
    spots = spot_config(context)
    events = event_config(context)

    ranked_lots = rank([lot.model_dump() for lot in body.lots],
                       parking["filters"], parking["factors"], parking["weights"], TOP_N, context)
    ranked_spots = rank([s.model_dump() for s in body.spots],
                        spots["filters"], spots["factors"], spots["weights"], TOP_N, context)
    ranked_events = rank([e.model_dump() for e in body.events],
                         events["filters"], events["factors"], events["weights"], TOP_N, context)

    return {
        "parking": [_result(r, "parking", with_parking_fields=True, context=context)
                    for r in ranked_lots],
        "spots": [_result(r, "spot") for r in ranked_spots],
        "events": [_result(r, "event") for r in ranked_events],
    }
