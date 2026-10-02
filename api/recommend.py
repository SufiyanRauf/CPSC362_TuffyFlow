import os
import sys

from fastapi import FastAPI
from pydantic import BaseModel, Field

# Vercel runs this from /var/task with api/ not on the path, so scoring is not
# importable by name there even though it sits next to this file.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scoring import (
    arrive_by, event_config, parking_config, rank, spot_config,
)

app = FastAPI()


# Full path, not "/recommend". Vercel passes the original path through to the app.
@app.get("/api/recommend")
def health() -> dict:
    return {"ok": True, "status": "healthy"}


class Profile(BaseModel):
    permit_type: str
    noise_pref: int = Field(ge=1, le=5)
    interests: list[str]
    career_goals: list[str]


class Lot(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    permit_type: str


class Availability(BaseModel):
    lot_id: str
    day_of_week: int = Field(ge=0, le=6)
    hour: int
    typical_pct_full: int = Field(ge=0, le=100)


class Spot(BaseModel):
    id: str
    name: str
    kind: str | None = None
    lat: float
    lng: float
    noise_level: int = Field(ge=1, le=5)
    has_outlets: bool
    opens_at: str | None = None
    closes_at: str | None = None


class Event(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    tags: list[str]
    starts_minutes: int
    ends_minutes: int
    day_offset: int


class ClassWindow(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start: int
    end: int


class RecommendRequest(BaseModel):
    profile: Profile
    dest_lat: float
    dest_lng: float
    dest_name: str
    now_minutes: int = Field(ge=0, le=1439)
    day_of_week: int = Field(ge=0, le=6)
    arrival_hour: int = Field(ge=0, le=23)
    class_start_minutes: int
    class_day_offset: int = Field(default=0, ge=0, le=7)
    lots: list[Lot]
    availability: list[Availability]
    spots: list[Spot]
    events: list[Event]
    class_meetings: list[ClassWindow] = []


def _result(entry, category, with_arrive_by=None, context=None):
    item = entry["item"]
    walk = entry.get("walk_minutes")
    return {
        "id": item["id"],
        "category": category,
        "title": item["name"],
        "match_percent": entry["match_percent"],
        "reason": entry["reasons"][0] if entry["reasons"] else "",
        "reasons": entry["reasons"],
        "lat": item.get("lat"),
        "lng": item.get("lng"),
        "kind": item.get("kind"),
        "walk_minutes": walk,
        "arrive_by": arrive_by(item, context, walk) if with_arrive_by else None,
    }


@app.post("/api/recommend")
def recommend(body: RecommendRequest) -> dict:
    context = body.model_dump()
    context["profile"] = body.profile.model_dump()

    parking = parking_config(context)
    spots = spot_config(context)
    events = event_config(context)

    ranked_lots = rank([l.model_dump() for l in body.lots],
                       parking["filters"], parking["factors"], parking["weights"], 20, context)
    ranked_spots = rank([s.model_dump() for s in body.spots],
                        spots["filters"], spots["factors"], spots["weights"], 20, context)
    ranked_events = rank([e.model_dump() for e in body.events],
                         events["filters"], events["factors"], events["weights"], 20, context)

    return {
        "parking": [_result(r, "parking", True, context) for r in ranked_lots],
        "spots": [_result(r, "spot") for r in ranked_spots],
        "events": [_result(r, "event") for r in ranked_events],
    }
