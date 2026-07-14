"""
tests the full pipeline wiring end to end, using the same fake model
pattern from the parser/writer tests - no real api calls.
"""

from tailorpilot.graph import run_pipeline
from tailorpilot.schemas import ParsedJobPosting, TailoredBullet, TailoredCV

ORIGINAL_CV = "built and maintained etl pipelines using python and airflow at acme corp."


class FakeStructuredModel:
    """returns different fake results depending on what schema was asked for."""

    def __init__(self, schema):
        self.schema = schema

    def invoke(self, prompt):
        if self.schema is ParsedJobPosting:
            return ParsedJobPosting(
                title="senior data engineer",
                company="acme corp",
                seniority="senior",
                required_skills=["python", "airflow"],
                responsibilities=["build etl pipelines"],
            )
        return TailoredCV(
            summary="data engineer with etl experience",
            bullets=[
                TailoredBullet(
                    text="built etl pipelines using python and airflow",
                    source_span="built and maintained etl pipelines using python and airflow at acme corp.",
                )
            ],
        )


class FakeModel:
    def with_structured_output(self, schema):
        return FakeStructuredModel(schema)


def test_run_pipeline_returns_grounded_cv():
    tailored_cv, parsed_posting = run_pipeline("some raw job posting text", ORIGINAL_CV, FakeModel())

    assert isinstance(tailored_cv, TailoredCV)
    assert len(tailored_cv.bullets) == 1
    assert tailored_cv.summary

    assert isinstance(parsed_posting, ParsedJobPosting)
    assert parsed_posting.title == "senior data engineer"
    assert parsed_posting.company == "acme corp"