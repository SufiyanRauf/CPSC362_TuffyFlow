"""Scoring endpoint stub.

Week 1 only proves this deploys alongside the React app. The real ranking engine arrives
in week 4.

Two things here are deliberate and easy to get wrong later:

1. The route is declared with its FULL path, "/api/recommend". On Vercel this function
   receives the original request path, not a path relative to the file, so a bare
   "/recommend" would never match.

2. The handler is `def`, not `async def`. Scoring is pure arithmetic with no waiting on a
   database or network, so async buys nothing here and makes it easy to block the event
   loop by accident. FastAPI runs a plain `def` route in a threadpool.
"""

from fastapi import FastAPI

app = FastAPI()


@app.get("/api/recommend")
def health() -> dict:
    return {"ok": True}
