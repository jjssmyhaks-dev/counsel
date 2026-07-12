"""LLM prompt builder — stub implementation for MVP.

In the stub mode, returns simulated completions based on prompt templates.
When wired to a real LLM (openai/anthropic), sends HTTP requests.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


class Generator:
    """Prompt builder with optional LLM backend.

    Supports stub (simulated), openai, and anthropic backends.
    The stub mode provides realistic simulated responses for testing.
    """

    SYSTEM_PROMPTS = {
        "contract_analysis": (
            "You are an expert legal contract analyst. You extract clause types, "
            "evaluate risk levels (low/medium/high), provide rationale, and "
            "suggest specific edits. Be precise and cite the exact language."
        ),
        "research_synthesis": (
            "You are a legal research synthesizer. Given source document excerpts, "
            "you identify key findings, agreements/disagreements, and gaps. "
            "Cite specific document chunks. Distinguish facts from interpretations."
        ),
        "draft": (
            "You are a professional legal drafter. You produce polished, formal "
            "business writing matching the requested type and tone. Be precise, "
            "professional, and reference applicable context."
        ),
        "meeting": (
            "You process meeting transcripts to extract: decisions made, action "
            "items (with owners), and open questions. Be thorough and precise."
        ),
    }

    def __init__(self) -> None:
        self.provider = settings.llm_provider

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Generate a completion (stub or real LLM)."""
        if self.provider == "stub":
            return self._stub_completion(system_prompt, user_prompt)
        elif self.provider == "openai":
            return await self._openai_completion(system_prompt, user_prompt)
        elif self.provider == "anthropic":
            return await self._anthropic_completion(system_prompt, user_prompt)
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

    def _stub_completion(self, system_prompt: str, user_prompt: str) -> str:
        """Simulated completion for MVP testing."""
        logger.info("Generating stub completion (system=%d chars, user=%d chars)",
                     len(system_prompt), len(user_prompt))
        return json.dumps({
            "mode": "stub",
            "system_preview": system_prompt[:200] + "...",
            "user_prompt_length": len(user_prompt),
        })

    async def _openai_completion(self, system_prompt: str, user_prompt: str) -> str:
        """Call OpenAI-compatible API."""
        if not settings.llm_api_key:
            raise ValueError("llm_api_key not configured for OpenAI")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.llm_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                },
                timeout=60.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _anthropic_completion(self, system_prompt: str, user_prompt: str) -> str:
        """Call Anthropic API."""
        if not settings.llm_api_key:
            raise ValueError("llm_api_key not configured for Anthropic")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.llm_api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 4096,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
                timeout=60.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]


generator = Generator()
