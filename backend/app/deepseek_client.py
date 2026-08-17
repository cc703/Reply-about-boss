"""Minimal DeepSeek Chat Completions client for local backend use."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, Iterable, List, Mapping, Optional


DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-v4-flash"


class MissingApiKeyError(RuntimeError):
    """Raised when the local backend has no DeepSeek API key."""


class DeepSeekRequestError(RuntimeError):
    """Raised when DeepSeek returns an unusable response."""


def _looks_like_json_payload(value: str) -> bool:
    text = str(value or "").strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE).strip()
    return text.startswith(("{", "["))


def _clean_draft(candidate: Mapping[str, Any]) -> Optional[Dict[str, str]]:
    tone = " ".join(str(candidate.get("tone") or "稳妥").split()).strip() or "稳妥"
    text = " ".join(str(candidate.get("text") or "").split()).strip()

    if not text or _looks_like_json_payload(text):
        return None

    return {
        "tone": tone[:24],
        "text": text[:800],
    }


def parse_drafts_from_content(content: str) -> List[Dict[str, str]]:
    text = str(content or "").strip()
    if not text:
        return []

    for _ in range(3):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text).strip()
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            normalized = " ".join(text.split()).strip()
            if _looks_like_json_payload(normalized):
                return []
            return [{"tone": "稳妥", "text": normalized[:800]}] if normalized else []

        if isinstance(parsed, str):
            text = parsed.strip()
            continue
        break

    raw_drafts = parsed.get("drafts") if isinstance(parsed, dict) else None
    if not isinstance(raw_drafts, list):
        normalized = " ".join(text.split()).strip()
        if _looks_like_json_payload(normalized):
            return []
        return [{"tone": "稳妥", "text": normalized[:800]}] if normalized else []

    drafts: List[Dict[str, str]] = []
    for draft in raw_drafts:
        if isinstance(draft, Mapping):
            cleaned = _clean_draft(draft)
            if cleaned:
                drafts.append(cleaned)
        if len(drafts) >= 3:
            break

    return drafts


def build_deepseek_payload(messages: Iterable[Mapping[str, str]], *, model: str = DEFAULT_MODEL) -> Dict[str, Any]:
    return {
        "model": model,
        "messages": list(messages),
        "temperature": 0.4,
        "max_tokens": 600,
        "response_format": {"type": "json_object"},
    }


class DeepSeekClient:
    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        base_url: str = DEFAULT_BASE_URL,
        model: str = DEFAULT_MODEL,
        opener: Optional[Any] = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.getenv("DEEPSEEK_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.opener = opener

    def create_reply_drafts(self, messages: Iterable[Mapping[str, str]]) -> Dict[str, Any]:
        if not self.api_key:
            raise MissingApiKeyError("DEEPSEEK_API_KEY is not set")

        payload = build_deepseek_payload(messages, model=self.model)
        request = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            open_fn = self.opener.open if self.opener is not None else urllib.request.urlopen
            with open_fn(request, timeout=30) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            raise DeepSeekRequestError(str(error)) from error

        choices = response_payload.get("choices") if isinstance(response_payload, dict) else None
        if not choices:
            raise DeepSeekRequestError("missing choices in DeepSeek response")

        content = choices[0].get("message", {}).get("content", "")
        return {
            "drafts": parse_drafts_from_content(content),
            "model": response_payload.get("model", self.model),
        }
