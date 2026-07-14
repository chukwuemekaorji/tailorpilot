"""
tests for the writer node. same approach as the parser tests -
fake model, no real api calls, just checking the wiring is correct.
"""

from tailorpilot.schemas import CoverLetter, ParsedJobPosting, TailoredBullet, TailoredCV
from tailorpilot.writer import write_cover_letter, write_tailored_cv


class FakeStructuredModel:
    """returns different fake results depending on what schema was asked for."""

    def __init__(self, schema):
        self.schema = schema

    def invoke(self, prompt):
        if self.schema is CoverLetter:
            return CoverLetter(text="dear hiring manager, i'm excited to apply for this role...")

        return TailoredCV(
            summary="experienced data engineer with a background in etl pipelines",
            bullets=[
                TailoredBullet(
                    text="built and maintained etl pipelines processing large datasets",
                    source_span="built etl pipelines for the analytics team",
                )
            ],
        )


class FakeModel:
    def with_structured_output(self, schema):
        return FakeStructuredModel(schema)


def test_write_tailored_cv_returns_structured_data():
    parsed = ParsedJobPosting(
        title="senior data engineer",
        company="acme corp",
        seniority="senior",
        required_skills=["python", "aws"],
        responsibilities=["build etl pipelines"],
    )

    result = write_tailored_cv(parsed, "some original cv text here", FakeModel())

    assert isinstance(result, TailoredCV)
    assert len(result.bullets) == 1
    assert result.bullets[0].source_span


def test_write_cover_letter_returns_structured_data():
    parsed = ParsedJobPosting(
        title="senior data engineer",
        company="acme corp",
        seniority="senior",
        required_skills=["python", "aws"],
        responsibilities=["build etl pipelines"],
    )

    result = write_cover_letter(parsed, "some original cv text here", FakeModel())

    assert isinstance(result, CoverLetter)
    assert result.text