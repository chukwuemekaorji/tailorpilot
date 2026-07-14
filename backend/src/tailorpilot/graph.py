"""
wires parser, writer, and grounder together into one langgraph pipeline.

this is the actual "brain" of tailorpilot - everything else (the extension,
the dashboard, the api endpoint) just calls run_pipeline() and gets a
finished, grounded cv back.
"""

from typing import TypedDict

from langchain_core.language_models import BaseChatModel
from langgraph.graph import END, StateGraph

from tailorpilot.grounder import ground_tailored_cv
from tailorpilot.parser import parse_job_posting
from tailorpilot.schemas import ParsedJobPosting, TailoredCV
from tailorpilot.writer import write_tailored_cv


class PipelineState(TypedDict):
    """
    the shared state that flows through the graph. each node reads what
    it needs off this and writes its result back onto it for the next
    node to pick up.
    """

    raw_job_posting: str
    original_cv_text: str
    model: BaseChatModel
    parsed_posting: ParsedJobPosting | None
    tailored_cv: TailoredCV | None
    final_cv: TailoredCV | None


def _parser_node(state: PipelineState) -> dict:
    parsed = parse_job_posting(state["raw_job_posting"], state["model"])
    return {"parsed_posting": parsed}


def _writer_node(state: PipelineState) -> dict:
    tailored = write_tailored_cv(
        state["parsed_posting"], state["original_cv_text"], state["model"]
    )
    return {"tailored_cv": tailored}


def _grounder_node(state: PipelineState) -> dict:
    final = ground_tailored_cv(state["tailored_cv"], state["original_cv_text"])
    return {"final_cv": final}


def build_pipeline():
    """builds and compiles the langgraph graph. call once, reuse the compiled graph."""
    graph = StateGraph(PipelineState)

    graph.add_node("parser", _parser_node)
    graph.add_node("writer", _writer_node)
    graph.add_node("grounder", _grounder_node)

    graph.set_entry_point("parser")
    graph.add_edge("parser", "writer")
    graph.add_edge("writer", "grounder")
    graph.add_edge("grounder", END)

    return graph.compile()


# compiled once at import time, reused across requests
pipeline = build_pipeline()


def run_pipeline(
    raw_job_posting: str, original_cv_text: str, model: BaseChatModel
) -> tuple[TailoredCV, ParsedJobPosting]:
    """
    the actual function everything else calls - runs the full pipeline end
    to end. also hands back the parsed posting (title/company) alongside
    the tailored cv, so callers can save a real history entry instead of
    a placeholder.
    """
    result = pipeline.invoke(
        {
            "raw_job_posting": raw_job_posting,
            "original_cv_text": original_cv_text,
            "model": model,
            "parsed_posting": None,
            "tailored_cv": None,
            "final_cv": None,
        }
    )
    return result["final_cv"], result["parsed_posting"]