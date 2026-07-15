"""CrewAI LLM wrapper for Cloudflare Workers AI.

This wraps the existing CloudflareAI provider as a CrewAI-compatible LLM,
so all agents and crews can use our Cloudflare Workers AI models directly.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from crewai import LLM

from ..providers.cloudflare import get_cloudflare

logger = logging.getLogger(__name__)


class CloudflareLLM(LLM):
    """CrewAI-compatible LLM backed by Cloudflare Workers AI.

    Uses Llama 4 Scout 17B for fast text generation; supports
    Llama 3.3 70B and DeepSeek R1 Distill Qwen 32B as fallbacks.
    """

    model: str = "@cf/meta/llama-4-scout-17b-16e-instruct"
    _temperature: float = 0.3
    _max_tokens: int = 4096

    def __init__(
        self,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        **kwargs,
    ):
        super().__init__(model=model or self.model, **kwargs)
        self._temperature = temperature
        self._max_tokens = max_tokens

    def call(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]] = None,
        callbacks: Optional[List[Any]] = None,
        **kwargs,
    ) -> str:
        """Synchronous call — delegates to async implementation."""
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(self._acall(messages, tools, **kwargs))

    async def _acall(
        self,
        messages: List[Dict[str, str]],
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs,
    ) -> str:
        """Async call to Cloudflare Workers AI text generation."""
        cf = get_cloudflare()

        # CrewAI sends messages as a list; convert to the format
        # Cloudflare Workers AI expects: system prompt + user message
        system_prompt: Optional[str] = None
        user_prompts: List[str] = []

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                system_prompt = content
            elif role == "user":
                user_prompts.append(content)
            elif role == "assistant":
                # For multi-turn, we append assistant responses as context
                user_prompts.append(f"[ASSISTANT]: {content}")

        prompt = "\n\n".join(user_prompts)

        try:
            response = await cf.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                model=self.model,
                max_tokens=self._max_tokens,
                temperature=self._temperature,
            )
            return response
        except Exception as e:
            logger.error("Cloudflare LLM call failed: %s", e)
            # Fallback: try the 70B model if the fast model fails
            try:
                return await cf.generate(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    model="@cf/meta/llama-3.3-70b-instruct-fp8-fast",
                    max_tokens=self._max_tokens,
                    temperature=self._temperature,
                )
            except Exception:
                raise RuntimeError(f"Cloudflare LLM call failed: {e}")


# Model presets for different agent roles
def get_default_llm(temperature: float = 0.3) -> CloudflareLLM:
    """Fast model for most agents — Llama 4 Scout 17B."""
    return CloudflareLLM(
        model="@cf/meta/llama-4-scout-17b-16e-instruct",
        temperature=temperature,
        max_tokens=4096,
    )


def get_power_llm(temperature: float = 0.2) -> CloudflareLLM:
    """Powerful model for complex analysis — Llama 3.3 70B."""
    return CloudflareLLM(
        model="@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        temperature=temperature,
        max_tokens=8192,
    )


def get_reasoning_llm() -> CloudflareLLM:
    """Reasoning model for legal analysis — DeepSeek R1."""
    return CloudflareLLM(
        model="@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        temperature=0.1,
        max_tokens=16384,
    )
