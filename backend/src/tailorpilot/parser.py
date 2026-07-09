"""
the parser node - first step of the pipeline.

takes the messy raw text of a job posting (scraped straight off the page)
and turns it into a clean, structured ParsedJobPosting using an llm with
structured output. the model does the heavy lifting of figuring out what's
actually a skill vs a responsibility vs just page filler.
"""

from langchain_core.language_models import BaseChatModel

from tailorpilot.schemas import ParsedJobPosting


def parse_job_posting(raw_text: str, model: BaseChatModel) -> ParsedJobPosting:
    """
    takes raw scraped job posting text and returns a structured ParsedJobPosting.

    the model param is any langchain chat model - which provider actually gets
    used is decided elsewhere (see the model adapter, coming in section 6).
    this function doesn't care which one it is, it just needs something that
    supports structured output.
    """
    structured_model = model.with_structured_output(ParsedJobPosting)

    prompt = f"""you're reading a job posting scraped straight off a job site,
so it might have messy formatting, nav bar text, or unrelated junk mixed in.
pull out only the real job details.

job posting text:
{raw_text}
"""

    result = structured_model.invoke(prompt)
    return result