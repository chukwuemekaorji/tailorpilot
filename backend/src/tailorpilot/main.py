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

from pydantic import BaseModel as PydanticBaseModel

from tailorpilot.graph import run_pipeline
from tailorpilot.model_adapter import get_model
from tailorpilot.schemas import TailoredCV


class TailorRequest(PydanticBaseModel):
    """what the extension/dashboard sends us to kick off the pipeline."""

    raw_job_posting: str
    original_cv_text: str
    provider: str
    model_name: str
    api_key: str


@app.post("/tailor", response_model=TailoredCV)
def tailor_cv(request: TailorRequest):
    """
    the main endpoint - takes a job posting + cv + the user's chosen
    provider and key, runs the full pipeline, returns the grounded result.
    """
    model = get_model(request.provider, request.model_name, request.api_key)
    result = run_pipeline(request.raw_job_posting, request.original_cv_text, model)
    return result