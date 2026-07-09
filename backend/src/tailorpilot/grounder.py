"""
the grounder node - third and most important step of the pipeline.

for every bullet the writer produced, this checks whether its source_span
actually appears (closely enough) in the user's real cv text. if it doesn't
pass the threshold, the bullet gets stripped before the user ever sees it.

this is deliberately NOT just "ask the llm if it's telling the truth" -
that's the same model that might have hallucinated in the first place,
so we back it with a local embedding similarity check that's independent
of the writer model entirely.
"""

from sentence_transformers import SentenceTransformer, util

from tailorpilot.schemas import GroundingResult, TailoredBullet, TailoredCV

# similarity below this means the claimed source_span probably isn't
# really in the original cv - tune this if you find it too strict or too loose
SIMILARITY_THRESHOLD = 0.6

# loading the model is slow, so we do it once at import time and reuse it,
# rather than reloading it for every single bullet we check
_embedding_model = SentenceTransformer("all-MiniLM-L6-v2")


def _check_bullet_grounding(bullet: TailoredBullet, original_cv_text: str) -> GroundingResult:
    """
    checks a single bullet's source_span against the original cv.

    we're not looking for an exact substring match here - the model might
    paraphrase slightly even in the source_span - so we use embedding
    similarity instead, which tolerates minor wording differences but still
    catches spans that are just made up.
    """
    span_embedding = _embedding_model.encode(bullet.source_span, convert_to_tensor=True)
    cv_embedding = _embedding_model.encode(original_cv_text, convert_to_tensor=True)

    similarity = util.cos_sim(span_embedding, cv_embedding).item()

    return GroundingResult(
        bullet=bullet,
        is_grounded=similarity >= SIMILARITY_THRESHOLD,
        similarity_score=similarity,
    )


def ground_tailored_cv(tailored_cv: TailoredCV, original_cv_text: str) -> TailoredCV:
    """
    takes the writer's output and strips out any bullet that can't be
    grounded in the original cv. returns a new TailoredCV with only the
    verified bullets left.
    """
    results = [_check_bullet_grounding(b, original_cv_text) for b in tailored_cv.bullets]
    grounded_bullets = [r.bullet for r in results if r.is_grounded]

    return TailoredCV(
        summary=tailored_cv.summary,
        bullets=grounded_bullets,
        cover_letter=tailored_cv.cover_letter,
    )