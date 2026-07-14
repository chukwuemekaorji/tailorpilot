"""
the writer node - second step of the pipeline.

takes the parsed job posting (from the parser node) and the user's original
cv text, and produces a tailored cv. this output is NOT trusted yet - it
still has to go through the grounder node before it reaches the user,
since the model could invent things here.

cover letters are handled separately by write_cover_letter() below, called
on demand from its own endpoint rather than bundled into every tailoring
run - most of the time someone just wants the tailored cv.
"""

from langchain_core.language_models import BaseChatModel

from tailorpilot.schemas import CoverLetter, ParsedJobPosting, TailoredCV


def write_tailored_cv(
    parsed_posting: ParsedJobPosting,
    original_cv_text: str,
    model: BaseChatModel,
) -> TailoredCV:
    """
    generates a tailored cv based on the parsed job posting and the
    user's real cv text.

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


def revise_tailored_cv(
    current_cv: TailoredCV,
    instruction: str,
    original_cv_text: str,
    model: BaseChatModel,
) -> TailoredCV:
    """
    applies a user's edit instruction ("make bullet 2 shorter", "drop the
    third bullet") to an already-tailored cv. same source_span rule as
    write_tailored_cv - the caller still runs this back through the
    grounder, since a revision is just another chance for the model to
    invent something.
    """
    structured_model = model.with_structured_output(TailoredCV)

    bullets_text = "\n".join(f"- {b.text} (source: {b.source_span})" for b in current_cv.bullets)

    prompt = f"""here's a cv that's already been tailored to a job posting:

summary: {current_cv.summary}

bullets:
{bullets_text}

the person reviewing it wants this change: {instruction}

apply that change and return the full updated cv - summary and all bullets,
not just the ones that changed. don't invent any experience, skills, or
achievements that aren't already present in the original cv below. for every
bullet, include the exact source_span from the original cv it's based on.

original cv:
{original_cv_text}
"""

    result = structured_model.invoke(prompt)
    return result


def write_cover_letter(
    parsed_posting: ParsedJobPosting,
    original_cv_text: str,
    model: BaseChatModel,
) -> CoverLetter:
    """generates a cover letter tailored to this job posting, based on the
    user's real cv - same no-inventing-experience rule as the cv writer."""
    structured_model = model.with_structured_output(CoverLetter)

    prompt = f"""write a cover letter tailored to the job posting below, based
on the candidate's real cv. don't invent any experience, skills, or
achievements that aren't already present in the original cv - only draw on
what's actually there.

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


def revise_cover_letter(
    current_letter: CoverLetter,
    instruction: str,
    original_cv_text: str,
    model: BaseChatModel,
) -> CoverLetter:
    """applies a user's edit instruction to an already-written cover letter,
    same idea as revise_tailored_cv but for the plain-text cover letter."""
    structured_model = model.with_structured_output(CoverLetter)

    prompt = f"""here's a cover letter that's already been written for a job posting:

{current_letter.text}

the person reviewing it wants this change: {instruction}

apply that change and return the full updated cover letter. don't invent any
experience, skills, or achievements that aren't already present in the
original cv below.

original cv:
{original_cv_text}
"""

    result = structured_model.invoke(prompt)
    return result