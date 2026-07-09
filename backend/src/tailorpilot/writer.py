"""
the writer node - second step of the pipeline.

takes the parsed job posting (from the parser node) and the user's original
cv text, and produces a tailored cv + cover letter. this output is NOT
trusted yet - it still has to go through the grounder node before it
reaches the user, since the model could invent things here.
"""

from langchain_core.language_models import BaseChatModel

from tailorpilot.schemas import ParsedJobPosting, TailoredCV


def write_tailored_cv(
    parsed_posting: ParsedJobPosting,
    original_cv_text: str,
    model: BaseChatModel,
) -> TailoredCV:
    """
    generates a tailored cv + cover letter based on the parsed job posting
    and the user's real cv text.

    important: every bullet the model writes needs a source_span pointing
    back to the exact text in original_cv_text it's based on. we ask for
    this explicitly in the prompt because the grounder node depends on it -
    it can't verify a claim it can't trace back to something.
    """
    structured_model = model.with_structured_output(TailoredCV)

    prompt = f"""you're tailoring a cv to a specific job posting. don't invent
any experience, skills, or achievements that aren't already present in the
original cv below - only reorder, re-emphasize, and rephrase what's actually there.

for every bullet you write, include the exact source_span from the original cv
that it's based on. if you can't point to something real in the original cv,
don't write the bullet.

job posting details:
title: {parsed_posting.title}
seniority: {parsed_posting.seniority}
required skills: {", ".join(parsed_posting.required_skills)}
responsibilities: {", ".join(parsed_posting.responsibilities)}

original cv:
{original_cv_text}
"""

    result = structured_model.invoke(prompt)
    return result