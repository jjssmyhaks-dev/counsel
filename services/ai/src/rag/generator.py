"""LLM generator — Cloudflare Workers AI with stub fallback."""
from __future__ import annotations

import json
import logging
from typing import Dict, List, Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


class Generator:
    """LLM provider — Cloudflare Workers AI (primary) or stub (fallback).

    Text generation model: @cf/meta/llama-4-scout-17b-16e-instruct (fast, 16B)
    Also supports: deepseek-r1-distill-qwen-32b (reasoning) for complex analysis.
    """

    SYSTEM_PROMPTS: Dict[str, str] = {
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
        self.provider: str = settings.llm_provider
        self._has_cloudflare: bool | None = None

    async def _get_cf(self):
        """Try to get CloudflareAI singleton."""
        try:
            from ..providers.cloudflare import get_cloudflare
            return get_cloudflare()
        except RuntimeError:
            return None

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> str:
        """Generate a completion — Cloudflare first, stub fallback."""
        if self.provider == "cloudflare":
            cf = await self._get_cf()
            if cf:
                return await cf.generate(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    model=model,
                    max_tokens=max_tokens,
                )
            else:
                logger.warning("Cloudflare not initialized, falling back to stub")
                return self._stub_completion(system_prompt or "", prompt)

        elif self.provider == "openai":
            return await self._openai_completion(system_prompt or "", prompt)
        elif self.provider == "anthropic":
            return await self._anthropic_completion(system_prompt or "", prompt)
        else:
            return self._stub_completion(system_prompt or "", prompt)

    async def generate_with_context(
        self,
        prompt: str,
        context_chunks: List[str],
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> str:
        """RAG generation with retrieved context."""
        if self.provider == "cloudflare":
            cf = await self._get_cf()
            if cf:
                return await cf.generate_with_context(
                    prompt=prompt,
                    context_chunks=context_chunks,
                    system_prompt=system_prompt,
                    max_tokens=max_tokens,
                )

        # Fallback: format context into prompt for stub/other providers
        context_text = "\n\n---\n\n".join(
            f"[SOURCE {i+1}]:\n{chunk}" for i, chunk in enumerate(context_chunks)
        )
        full_prompt = f"""SOURCES:\n{context_text}\n\nQUESTION:\n{prompt}\n\nANSWER:"""
        return await self.generate(prompt=full_prompt, system_prompt=system_prompt, max_tokens=max_tokens)

    def _stub_completion(self, system_prompt: str, user_prompt: str) -> str:
        logger.info("Stub completion (system=%d, user=%d)", len(system_prompt), len(user_prompt))
        return json.dumps({
            "mode": "stub",
            "system_preview": system_prompt[:200] + "...",
            "user_prompt_length": len(user_prompt),
        })

    async def _openai_completion(self, system_prompt: str, user_prompt: str) -> str:
        if not settings.llm_api_key:
            raise ValueError("llm_api_key not configured")
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
            return resp.json()["choices"][0]["message"]["content"]

    async def _anthropic_completion(self, system_prompt: str, user_prompt: str) -> str:
        if not settings.llm_api_key:
            raise ValueError("llm_api_key not configured")
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
            return resp.json()["content"][0]["text"]


generator = Generator()
