"""
tests for the parser node.

we don't want to hit a real llm api in tests - that costs money, is slow,
and makes tests flaky depending on network conditions. so we fake the model
here with a stub that just returns a fixed result, and check that
parse_job_posting wires things together correctly.
"""

from tailorpilot.parser import parse_job_posting
from tailorpilot.schemas import ParsedJobPosting


class FakeStructuredModel:
    """stands in for a real llm's structured output call."""

    def invoke(self, prompt):
        return ParsedJobPosting(
            title="senior data engineer",
            company="acme corp",
            seniority="senior",
            required_skills=["python", "aws", "dbt"],
            responsibilities=["build etl pipelines", "own data quality"],
        )


class FakeModel:
    """stands in for a real langchain chat model."""

    def with_structured_output(self, schema):
        return FakeStructuredModel()


def test_parse_job_posting_returns_structured_data():
    fake_model = FakeModel()
    result = parse_job_posting("some messy job posting html here", fake_model)

    assert isinstance(result, ParsedJobPosting)
    assert result.title == "senior data engineer"
    assert "python" in result.required_skills