"""
entry point for the tailorpilot backend.

this is intentionally bare right now, just enough to prove the server
boots and responds. the actual parser/writer/grounder pipeline gets
wired in over the next few sections.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="tailorpilot")

app.add_middleware(
    CORSMiddleware,
    # wide open for now since we're still in dev and don't have a fixed
    # extension id yet - this gets locked down to the real extension
    # origin before this ever goes out to real users
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/health")
def health_check():
    """basic check so we know the server is alive. useful for render's health checks too."""
    return {"status": "ok"}

from pydantic import BaseModel as PydanticBaseModel

from tailorpilot.grounder import ground_tailored_cv
from tailorpilot.graph import run_pipeline
from tailorpilot.model_adapter import get_model
from tailorpilot.parser import parse_job_posting
from tailorpilot.schemas import CoverLetter, TailoredCV
from tailorpilot.writer import (
    revise_cover_letter,
    revise_tailored_cv,
    write_cover_letter,
)


class TailorRequest(PydanticBaseModel):
    """what the extension/dashboard sends us to kick off the pipeline."""

    raw_job_posting: str
    original_cv_text: str
    provider: str
    model_name: str
    api_key: str


class TailorResponse(PydanticBaseModel):
    """
    wraps the tailored cv with the job title/company the parser pulled out
    of the posting - callers (the extension) use these to save a real
    history entry instead of a placeholder.
    """

    tailored_cv: TailoredCV
    job_title: str
    company: str | None


class ReviseCVRequest(PydanticBaseModel):
    """an edit instruction applied to an already-tailored cv."""

    tailored_cv: TailoredCV
    instruction: str
    original_cv_text: str
    provider: str
    model_name: str
    api_key: str


class ReviseCoverLetterRequest(PydanticBaseModel):
    """an edit instruction applied to an already-written cover letter."""

    cover_letter: CoverLetter
    instruction: str
    original_cv_text: str
    provider: str
    model_name: str
    api_key: str


def _classify_provider_error(provider: str, exc: Exception) -> tuple[int, str, str]:
    """
    turns whatever exception a provider's sdk throws into a clean,
    user-facing error. anthropic/openai/google/groq each raise their own
    exception types for the same underlying situations (bad key, no
    credit, rate limited) - this reads the http status code and message
    that all of them carry instead of catching four different classes.
    """
    status_code = getattr(exc, "status_code", None)
    text = str(exc).lower()

    if status_code in (401, 403) or "invalid api key" in text or "incorrect api key" in text:
        return 401, "invalid_api_key", (
            f"that {provider} api key doesn't look right - double check it on the dashboard."
        )

    if (
        status_code == 402
        or "credit balance" in text
        or "insufficient_quota" in text
        or "exceeded your current quota" in text
    ):
        return 402, "insufficient_credits", (
            f"your {provider} account is out of credit - top it up or switch models on the dashboard."
        )

    if status_code == 429 or "rate limit" in text:
        return 429, "rate_limited", (
            f"{provider} is rate-limiting this key right now - wait a moment and try again."
        )

    return 502, "provider_error", (
        f"{provider} couldn't process that request - try again, or try a different model."
    )


@app.post("/tailor", response_model=TailorResponse)
def tailor_cv(request: TailorRequest):
    """
    the main endpoint - takes a job posting + cv + the user's chosen
    provider and key, runs the full pipeline, returns the grounded result
    along with the job title/company the parser found in the posting.
    """
    try:
        model = get_model(request.provider, request.model_name, request.api_key)
        tailored_cv, parsed_posting = run_pipeline(
            request.raw_job_posting, request.original_cv_text, model
        )
        return TailorResponse(
            tailored_cv=tailored_cv,
            job_title=parsed_posting.title,
            company=parsed_posting.company,
        )
    except Exception as exc:
        status_code, error_code, message = _classify_provider_error(request.provider, exc)
        raise HTTPException(status_code=status_code, detail={"error": error_code, "message": message})


@app.post("/cover-letter", response_model=CoverLetter)
def generate_cover_letter(request: TailorRequest):
    """
    separate from /tailor since not every tailoring run needs a cover
    letter - this only runs when the user explicitly asks for one, so we
    don't spend the extra api call/latency on every request by default.
    """
    try:
        model = get_model(request.provider, request.model_name, request.api_key)
        parsed_posting = parse_job_posting(request.raw_job_posting, model)
        return write_cover_letter(parsed_posting, request.original_cv_text, model)
    except Exception as exc:
        status_code, error_code, message = _classify_provider_error(request.provider, exc)
        raise HTTPException(status_code=status_code, detail={"error": error_code, "message": message})


@app.post("/revise-cv", response_model=TailoredCV)
def revise_cv(request: ReviseCVRequest):
    """
    applies an edit instruction to an already-tailored cv - "make bullet 2
    shorter", "drop the third one". runs back through the grounder since a
    revision is just another chance for the model to invent something.
    """
    try:
        model = get_model(request.provider, request.model_name, request.api_key)
        revised = revise_tailored_cv(
            request.tailored_cv, request.instruction, request.original_cv_text, model
        )
        return ground_tailored_cv(revised, request.original_cv_text)
    except Exception as exc:
        status_code, error_code, message = _classify_provider_error(request.provider, exc)
        raise HTTPException(status_code=status_code, detail={"error": error_code, "message": message})


@app.post("/revise-cover-letter", response_model=CoverLetter)
def revise_cover_letter_endpoint(request: ReviseCoverLetterRequest):
    """same idea as /revise-cv, for the plain-text cover letter."""
    try:
        model = get_model(request.provider, request.model_name, request.api_key)
        return revise_cover_letter(
            request.cover_letter, request.instruction, request.original_cv_text, model
        )
    except Exception as exc:
        status_code, error_code, message = _classify_provider_error(request.provider, exc)
        raise HTTPException(status_code=status_code, detail={"error": error_code, "message": message})