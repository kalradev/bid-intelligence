"""
LLM client: Sarvam AI (OpenAI-compatible /v1/chat/completions) or OpenAI / Azure OpenAI.

Sarvam: https://api.sarvam.ai/v1 with Authorization: Bearer <SARVAM_API_KEY>.
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from openai import OpenAI, AsyncOpenAI

from core.config import settings

logger = logging.getLogger(__name__)

_sync_client: Optional[OpenAI] = None
_async_client: Optional[AsyncOpenAI] = None


def _use_sarvam() -> bool:
    return bool(settings.SARVAM_API_KEY and str(settings.SARVAM_API_KEY).strip())


def llm_provider_label() -> str:
    return "sarvam" if _use_sarvam() else "openai"


def llm_configuration_hint() -> str:
    return "Set SARVAM_API_KEY (Sarvam) or OPENAI_API_KEY (OpenAI / Azure)."


def llm_quota_error_detail() -> str:
    if _use_sarvam():
        return (
            "Sarvam AI quota or rate limit reached. "
            "Check usage and billing at https://dashboard.sarvam.ai/"
        )
    return (
        "OpenAI API quota exceeded. "
        "Please check your billing at https://platform.openai.com/account/billing"
    )


def is_llm_configured() -> bool:
    return _use_sarvam() or bool(settings.OPENAI_API_KEY and str(settings.OPENAI_API_KEY).strip())


def supports_strict_json_response_format() -> bool:
    # Sarvam docs do not guarantee OpenAI-style response_format; prompts already request JSON.
    return not _use_sarvam()


# Sarvam-105b uses a reasoning phase; small max_tokens can consume the budget in reasoning
# and leave assistant `content` empty. Keep a floor so JSON/replies still materialize.
_SARVAM_MIN_COMPLETION_TOKENS = 2048


def _effective_max_tokens(requested: int) -> int:
    if not _use_sarvam():
        return requested
    return max(int(requested), _SARVAM_MIN_COMPLETION_TOKENS)


def _default_chat_model() -> str:
    if _use_sarvam():
        return (settings.SARVAM_CHAT_MODEL or "sarvam-105b").strip()
    return (settings.OPENAI_CHAT_MODEL or "gpt-4o-mini").strip()


def _build_client_kwargs() -> Dict[str, Any]:
    if _use_sarvam():
        base = (settings.SARVAM_BASE_URL or "https://api.sarvam.ai/v1").strip().rstrip("/")
        return {"api_key": settings.SARVAM_API_KEY or "", "base_url": base}
    kwargs: Dict[str, Any] = {"api_key": settings.OPENAI_API_KEY or ""}
    if settings.OPENAI_BASE_URL and settings.OPENAI_BASE_URL.strip():
        kwargs["base_url"] = settings.OPENAI_BASE_URL.strip().rstrip("/")
    return kwargs


def get_sync_chat_client() -> Optional[OpenAI]:
    global _sync_client
    if _sync_client is not None:
        return _sync_client
    if not is_llm_configured():
        logger.error("LLM not configured: %s", llm_configuration_hint())
        return None
    try:
        _sync_client = OpenAI(**_build_client_kwargs())
        logger.info("✅ LLM sync client initialized (%s)", llm_provider_label())
    except Exception as e:
        logger.error("❌ LLM sync client failed: %s", e)
        _sync_client = None
    return _sync_client


def get_async_chat_client() -> Optional[AsyncOpenAI]:
    global _async_client
    if _async_client is not None:
        return _async_client
    if not is_llm_configured():
        logger.warning("LLM not configured - async client unavailable")
        return None
    try:
        _async_client = AsyncOpenAI(**_build_client_kwargs())
        logger.info("✅ LLM async client initialized (%s)", llm_provider_label())
    except Exception as e:
        logger.error("❌ LLM async client failed: %s", e)
        _async_client = None
    return _async_client


def get_model_summary() -> str:
    if settings.LLM_MODEL_SUMMARY and settings.LLM_MODEL_SUMMARY.strip():
        return settings.LLM_MODEL_SUMMARY.strip()
    return _default_chat_model()


def get_model_eligibility() -> str:
    """Second-pass eligibility extraction; optional dedicated smaller/faster model."""
    if settings.LLM_MODEL_ELIGIBILITY and settings.LLM_MODEL_ELIGIBILITY.strip():
        return settings.LLM_MODEL_ELIGIBILITY.strip()
    return get_model_summary()


def get_model_oem() -> str:
    if settings.LLM_MODEL_OEM and settings.LLM_MODEL_OEM.strip():
        return settings.LLM_MODEL_OEM.strip()
    return get_model_summary()


def get_model_row_mapping() -> str:
    if settings.LLM_MODEL_ROW and settings.LLM_MODEL_ROW.strip():
        return settings.LLM_MODEL_ROW.strip()
    return get_model_summary()


def parse_json_from_response_content(content: Optional[str]) -> Any:
    """Parse model output as JSON; tolerate markdown fences and leading/trailing text."""
    if not content or not str(content).strip():
        raise ValueError("Empty LLM response content")
    text = str(content).strip()

    # Strip ```json ... ``` or ``` ... ```
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from model output: {text[:200]}...")


def chat_completion_sync(
    *,
    messages: List[Dict[str, str]],
    model: str,
    temperature: float,
    max_tokens: int,
    json_object: bool = False,
) -> Tuple[str, Optional[Any]]:
    """
    Returns (raw_content, usage_or_none).
    """
    cli = get_sync_chat_client()
    if not cli:
        raise RuntimeError(f"LLM client not initialized. {llm_configuration_hint()}")

    eff_max = _effective_max_tokens(max_tokens)
    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": eff_max,
    }
    if json_object and supports_strict_json_response_format():
        kwargs["response_format"] = {"type": "json_object"}

    response = cli.chat.completions.create(**kwargs)
    content = response.choices[0].message.content
    usage = getattr(response, "usage", None)
    return content or "", usage


async def chat_completion_async(
    *,
    messages: List[Dict[str, str]],
    model: str,
    temperature: float,
    max_tokens: int,
    json_object: bool = False,
) -> Tuple[str, Optional[Any]]:
    cli = get_async_chat_client()
    if not cli:
        raise RuntimeError(f"LLM async client not initialized. {llm_configuration_hint()}")

    eff_max = _effective_max_tokens(max_tokens)
    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": eff_max,
    }
    if json_object and supports_strict_json_response_format():
        kwargs["response_format"] = {"type": "json_object"}

    response = await cli.chat.completions.create(**kwargs)
    content = response.choices[0].message.content
    usage = getattr(response, "usage", None)
    return content or "", usage
