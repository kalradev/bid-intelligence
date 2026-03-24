"""
HTTP client for Ollama's /api/chat (JSON responses).
"""
import json
import logging
import re
from typing import Any, Dict, List

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


def _base_url() -> str:
    return (settings.OLLAMA_BASE_URL or "").strip().rstrip("/")


def ollama_configured() -> bool:
    return bool(_base_url() and (settings.OLLAMA_MODEL or "").strip())


def _parse_json_content(content: str) -> Dict[str, Any]:
    text = (content or "").strip()
    if not text:
        raise ValueError("Empty response from Ollama")
    fence = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", text, re.IGNORECASE | re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def ollama_chat_json_sync(
    messages: List[Dict[str, str]],
    *,
    temperature: float = 0.3,
    num_predict: int = 16384,
    json_format: bool = True,
) -> Dict[str, Any]:
    base = _base_url()
    model = (settings.OLLAMA_MODEL or "").strip()
    if not base or not model:
        raise RuntimeError("OLLAMA_BASE_URL and OLLAMA_MODEL must be set in environment")

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": num_predict},
    }
    if json_format:
        payload["format"] = "json"

    url = f"{base}/api/chat"
    with httpx.Client(timeout=httpx.Timeout(600.0, connect=60.0)) as client:
        r = client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()

    msg = data.get("message") or {}
    content = msg.get("content", "")
    parsed = _parse_json_content(content)
    prompt_n = int(data.get("prompt_eval_count") or 0)
    comp_n = int(data.get("eval_count") or 0)
    return {
        "parsed": parsed,
        "prompt_tokens": prompt_n,
        "completion_tokens": comp_n,
        "total_tokens": prompt_n + comp_n,
    }


async def ollama_chat_json_async(
    messages: List[Dict[str, str]],
    *,
    temperature: float = 0.3,
    num_predict: int = 16384,
    json_format: bool = True,
) -> Dict[str, Any]:
    base = _base_url()
    model = (settings.OLLAMA_MODEL or "").strip()
    if not base or not model:
        raise RuntimeError("OLLAMA_BASE_URL and OLLAMA_MODEL must be set in environment")

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": num_predict},
    }
    if json_format:
        payload["format"] = "json"

    url = f"{base}/api/chat"
    async with httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=60.0)) as client:
        r = await client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()

    msg = data.get("message") or {}
    content = msg.get("content", "")
    parsed = _parse_json_content(content)
    prompt_n = int(data.get("prompt_eval_count") or 0)
    comp_n = int(data.get("eval_count") or 0)
    return {
        "parsed": parsed,
        "prompt_tokens": prompt_n,
        "completion_tokens": comp_n,
        "total_tokens": prompt_n + comp_n,
    }
