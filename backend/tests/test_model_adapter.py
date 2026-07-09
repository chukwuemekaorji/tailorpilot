"""
tests for the model adapter.

we're not making real api calls here (that costs money and needs a real key),
just checking that each provider name correctly builds the right kind of
langchain client, and that an unsupported provider raises clearly instead
of failing silently somewhere deeper in the pipeline.
"""

import pytest
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI

from tailorpilot.model_adapter import get_model


def test_anthropic_provider_returns_chat_anthropic():
    model = get_model("anthropic", "claude-sonnet-5", "fake-key")
    assert isinstance(model, ChatAnthropic)


def test_google_provider_returns_chat_google():
    model = get_model("google", "gemini-2.0-flash", "fake-key")
    assert isinstance(model, ChatGoogleGenerativeAI)


def test_openai_provider_returns_chat_openai():
    model = get_model("openai", "gpt-4o", "fake-key")
    assert isinstance(model, ChatOpenAI)


def test_groq_provider_returns_chat_groq():
    model = get_model("groq", "llama-3.3-70b-versatile", "fake-key")
    assert isinstance(model, ChatGroq)


def test_unsupported_provider_raises_clear_error():
    with pytest.raises(ValueError, match="unsupported provider"):
        get_model("some-made-up-provider", "whatever", "fake-key")