from fastapi import FastAPI

app = FastAPI()

# Full path, not "/recommend". Vercel passes the original path through to the app.
@app.get("/api/recommend")
def health() -> dict:
    return {"ok": True, "status": "healthy"}
