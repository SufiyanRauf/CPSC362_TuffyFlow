from fastapi import FastAPI
from pydantic import BaseModel

from scoring import haversine, walk_minutes

app = FastAPI()

# Full path, not "/recommend". Vercel passes the original path through to the app.
@app.get("/api/recommend")
def health() -> dict:
    return {"ok": True, "status": "healthy"}


class EchoRequest(BaseModel):
    lat1: float
    lng1: float
    lat2: float
    lng2: float


@app.post("/api/recommend")
def echo(body: EchoRequest) -> dict:
    metres = haversine(body.lat1, body.lng1, body.lat2, body.lng2)
    return {"metres": round(metres), "walk_minutes": walk_minutes(metres)}
