"""Scoring endpoint. Returns a health check for now, the ranking lands in week 4."""

from fastapi import FastAPI

app = FastAPI()


# Full path, not "/recommend". Vercel passes the original path through to the app.
@app.get("/api/recommend")
def health() -> dict:
    return {"ok": True}
