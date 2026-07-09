"""
model adapter - turns a provider name + model name + api key into an
actual langchain chat model object that the pipeline nodes can use.

this is the ONLY place in the whole backend that knows or cares which
ai provider the user picked. parser, writer, and grounder never see a
provider name - they just get handed whatever model object this function
returns and call it the same way regardless.
"""

from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI

# providers we support right now - add a new one here and in get_model
# below when we want to support something else later
SUPPORTED_PROVIDERS = ["anthropic", "google", "openai", "groq"]


def get_model(provider: str, model_name: str, api_key: str) -> BaseChatModel:
    """
    builds a langchain chat model for whichever provider the user chose.

    provider: one of "anthropic", "google", "openai", "groq"
    model_name: the specific model, e.g. "claude-sonnet-5" or "gemini-2.0-flash"
    api_key: the user's own key for that provider - never stored here,
             just passed straight through to the client
    """
    if provider == "anthropic":
        return ChatAnthropic(model=model_name, api_key=api_key)
    elif provider == "google":
        return ChatGoogleGenerativeAI(model=model_name, google_api_key=api_key)
    elif provider == "openai":
        return ChatOpenAI(model=model_name, api_key=api_key)
    elif provider == "groq":
        return ChatGroq(model=model_name, api_key=api_key)
    else:
        raise ValueError(
            f"unsupported provider '{provider}' - must be one of {SUPPORTED_PROVIDERS}"
        )