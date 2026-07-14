"""
tests for the grounder node.

unlike the parser/writer tests, we don't fake the embedding model here -
it's free and local, so there's no cost or flakiness risk in actually
running it. we just check that a real, honest bullet passes, and a made up
one gets stripped.
"""

from tailorpilot.grounder import ground_tailored_cv
from tailorpilot.schemas import TailoredBullet, TailoredCV

ORIGINAL_CV = """
worked as a data engineer at acme corp for three years.
built and maintained etl pipelines using python and airflow.
managed a team of two junior engineers.
"""


def test_grounded_bullet_survives():
    tailored = TailoredCV(
        summary="data engineer with etl experience",
        bullets=[
            TailoredBullet(
                text="built etl pipelines using python and airflow",
                source_span="built and maintained etl pipelines using python and airflow",
            )
        ],
    )

    result = ground_tailored_cv(tailored, ORIGINAL_CV)

    assert len(result.bullets) == 1


def test_hallucinated_bullet_gets_stripped():
    tailored = TailoredCV(
        summary="data engineer with etl experience",
        bullets=[
            TailoredBullet(
                text="led a company-wide migration to kubernetes across 40 microservices",
                source_span="led a company-wide migration to kubernetes across 40 microservices",
            )
        ],
    )

    result = ground_tailored_cv(tailored, ORIGINAL_CV)

    assert len(result.bullets) == 0