"""
shared data shapes for the tailorpilot pipeline

these get passed between the parser, writer, and grounder nodes,
so keeping them in one place means every part of the pipeline agrees
on what a "job posting" or a "tailored cv" actually looks like.
"""

from pydantic import BaseModel, Field


class ParsedJobPosting(BaseModel):
    """what the parser node extracts from a messy job posting page."""

    title: str = Field(description="the job title, e.g. 'senior data engineer'")
    company: str | None = Field(default=None, description="company name, if we can find it")
    seniority: str = Field(description="junior, mid, senior, staff, etc — best guess based on the posting")
    required_skills: list[str] = Field(description="skills the posting explicitly asks for")
    responsibilities: list[str] = Field(description="what the role actually involves day to day")


class TailoredBullet(BaseModel):
    """a single rewritten cv bullet point."""

    text: str = Field(description="the rewritten bullet, tailored to the job posting")
    source_span: str = Field(description="the exact text from the original cv this bullet is based on")


class TailoredCV(BaseModel):
    """the writer node's output before grounding checks are applied."""

    summary: str = Field(description="a short professional summary tailored to this role")
    bullets: list[TailoredBullet]


class CoverLetter(BaseModel):
    """generated on demand, separately from the tailored cv - not every
    tailoring run needs one, so it isn't bundled into every request."""

    text: str = Field(description="a cover letter tailored to this specific job posting")


class GroundingResult(BaseModel):
    """the grounder node's verdict on a single tailored bullet."""

    bullet: TailoredBullet
    is_grounded: bool = Field(description="true if this bullet's claim actually traces back to the original cv")
    similarity_score: float = Field(description="how closely the source_span matches real cv text, 0 to 1")
