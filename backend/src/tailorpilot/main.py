"""
entry point for the tailorpilot backend.

this is intentionally bare right now, just enough to prove the server
boots and responds. the actual parser/writer/grounder pipeline gets
wired in over the next few sections.
"""

from fastapi import FastAPI

app = FastAPI(title="tailorpilot")


@app.get("/health")
def health_check():
    """basic check so we know the server is alive. useful for render's health checks too."""
    return {"status": "ok"}