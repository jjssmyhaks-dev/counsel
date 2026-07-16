"""CrewAI-compatible LLM wrapper for Cloudflare Workers AI.

Subclasses BaseLLM directly (not the LLM pydantic model) to bypass CrewAI's
hardcoded model-name validation. Implements a fully synchronous `call()` method
that works with CrewAI's thread-pool-based agent execution — no asyncio.
"""
from __future__ import annotations

import logging
import httpx
from typing import Any, Dict, List, Optional, Union

from crewai.llms.base_llm import BaseLLM

logger = logging.getLogger(__name__)

# Cloudflare Workers AI model IDs
CF_DEFAULT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct"
CF_POWER_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
CF_REASONING_MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b"


class CloudflareLLM(BaseLLM):
    """Synchronous CrewAI-compatible LLM backed by Cloudflare Workers AI.

    Subclasses BaseLLM directly — NOT the LLM pydantic model — to skip
    CrewAI's hardcoded provider-specific model-name validation.

    Attributes:
        model: The Cloudflare model ID (e.g. @cf/meta/llama-4-scout-17b-16e-instruct).
        api_base: Cloudflare Workers AI run endpoint URL.
        api_token: Cloudflare API token.
    """

    def __init__(
        self,
        model: str = CF_DEFAULT_MODEL,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        **kwargs,
    ):
        # Bypass pydantic field injection — set attributes directly on the internal
        # dict BEFORE calling super().__init__ so BaseLLM sees them as pre-set.
        super().__init__(model=model, **kwargs)
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

        # Resolve Cloudflare credentials
        from ..config import settings
        self._api_token = settings.cloudflare_api_token
        self._api_base = (
            f"https://api.cloudflare.com/client/v4/accounts/"
            f"{settings.cloudflare_account_id}/ai/run/"
        )

    # ──────────────────────────── CrewAI API ────────────────────────────

    def call(
        self,
        messages: Union[str, List[Dict[str, str]]],
        tools: Optional[List[Dict[str, Any]]] = None,
        callbacks: Optional[List[Any]] = None,
        **kwargs,
    ) -> str:
        """Synchronous chat completion as required by CrewAI's BaseLLM protocol.

        This runs in whatever thread CrewAI assigns — must be fully synchronous.
        """
        payload = self._build_payload(messages)
        url = f"{self._api_base}{self.model}"
        headers = {
            "Authorization": f"Bearer {self._api_token}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=90.0) as client:
                resp = client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()

            result = data.get("result", {})
            text = result.get("response", "")
            if not text:
                logger.warning("Empty response from Cloudflare; payload received: %s...",
                               str(result)[:200])
            return text
        except Exception as e:
            logger.error("Cloudflare LLM call failed (model=%s): %s", self.model, e)
            # Fallback: try the 70B model if this isn't already it
            if self.model != CF_POWER_MODEL:
                fallback_url = f"{self._api_base}{CF_POWER_MODEL}"
                try:
                    with httpx.Client(timeout=90.0) as client:
                        resp = client.post(fallback_url, json=payload, headers=headers)
                        resp.raise_for_status()
                        data = resp.json()
                    return data.get("result", {}).get("response", "")
                except Exception as fb_err:
                    logger.error("Fallback also failed: %s", fb_err)
            raise RuntimeError(f"Cloudflare LLM call failed: {e}")

    # ──────────────────────────── Internals ─────────────────────────────

    def _build_payload(
        self, messages: Union[str, List[Dict[str, str]]]
    ) -> Dict[str, Any]:
        """Convert CrewAI message format to Cloudflare Workers AI format.

        Cloudflare expects: {"messages": [{"role": ..., "content": ...}], ...}
        """
        system_prompt: Optional[str] = None
        user_msgs: List[Dict[str, str]] = []

        if isinstance(messages, str):
            user_msgs = [{"role": "user", "content": messages}]
        else:
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "system":
                    system_prompt = content
                else:
                    user_msgs.append({"role": role, "content": content})

        cf_messages: List[Dict[str, str]] = []
        if system_prompt:
            cf_messages.append({"role": "system", "content": system_prompt})
        cf_messages.extend(user_msgs)

        return {
            "messages": cf_messages,
            "max_tokens": int(self.max_tokens) if self.max_tokens else 4096,
            "temperature": float(self.temperature) if self.temperature else 0.3,
        }


# ──────────────────────────── Factory helpers ───────────────────────────

def get_default_llm(temperature: float = 0.3) -> CloudflareLLM:
    """Fast model for most agents — Llama 4 Scout 17B."""
    return CloudflareLLM(model=CF_DEFAULT_MODEL, temperature=temperature, max_tokens=4096)


def get_power_llm(temperature: float = 0.2) -> CloudflareLLM:
    """Powerful model for complex analysis — Llama 3.3 70B."""
    return CloudflareLLM(model=CF_POWER_MODEL, temperature=temperature, max_tokens=8192)


def get_reasoning_llm() -> CloudflareLLM:
    """Reasoning model for legal analysis — DeepSeek R1 Distill 32B."""
    return CloudflareLLM(model=CF_REASONING_MODEL, temperature=0.1, max_tokens=16384)
