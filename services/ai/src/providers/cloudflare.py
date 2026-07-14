from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


class CloudflareAI:
    """Cloudflare Workers AI client.

    Uses the Workers AI REST API for embeddings and text generation.
    Base URL: https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/

    Embedding models available on Workers AI:
      - @cf/baai/bge-base-en-v1.5  (768-dim)
      - @cf/baai/bge-small-en-v1.5 (384-dim)
      - @cf/baai/bge-large-en-v1.5 (1024-dim)

    Text generation models available:
      - @cf/meta/llama-4-scout-17b-16e-instruct (fast, 16B)
      - @cf/meta/llama-3.3-70b-instruct-fp8-fast (powerful, 70B)
      - @cf/deepseek-ai/deepseek-r1-distill-qwen-32b (reasoning)
    """

    BASE_URL = "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/"

    # Embedding model — BGE-base is strong for legal/contract text
    EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5"
    EMBEDDING_DIM = 768

    # Text generation model
    TEXT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct"

    def __init__(self, account_id: str, api_token: str) -> None:
        self.account_id = account_id
        self.api_token = api_token
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL.format(account_id=self.account_id),
                headers={
                    "Authorization": f"Bearer {self.api_token}",
                    "Content-Type": "application/json",
                },
                timeout=60.0,
            )
        return self._client

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    # ── Embeddings ──────────────────────────────────────────────────

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts using BGE-base."""
        if not texts:
            return []

        url = f"{self.EMBEDDING_MODEL}"
        results: List[List[float]] = []

        # Process in batches of 20 (Workers AI limit)
        batch_size = 20
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            try:
                resp = await self.client.post(url, json={"text": batch})
                resp.raise_for_status()
                data = resp.json()

                if not data.get("success", False):
                    errors = data.get("errors", [])
                    err_msg = "; ".join(str(e) for e in errors)
                    raise Exception(f"Cloudflare AI embedding failed: {err_msg}")

                result = data["result"]
                if "data" in result:
                    batch_embeddings = result["data"]
                elif isinstance(result, list):
                    batch_embeddings = result
                else:
                    raise Exception(f"Unexpected embedding response shape: {list(result.keys()) if isinstance(result, dict) else type(result)}")

                # Validate embedding dimensions (bge-base-en-v1.5 should return 768-dim)
                for idx, vec in enumerate(batch_embeddings):
                    if not isinstance(vec, list) or len(vec) != self.EMBEDDING_DIM:
                        raise Exception(
                            f"Embedding dimension mismatch at batch {i // batch_size}, item {idx}: "
                            f"expected {self.EMBEDDING_DIM}, got {len(vec) if isinstance(vec, list) else type(vec)}"
                        )

                results.extend(batch_embeddings)
                logger.info("Embedded batch %d/%d (%d texts)", i // batch_size + 1, (len(texts) + batch_size - 1) // batch_size, len(batch))

            except Exception as e:
                logger.error("Embedding batch %d failed: %s", i // batch_size, e)
                raise

        return results

    async def embed_single(self, text: str) -> List[float]:
        """Embed a single text (for query embedding)."""
        results = await self.embed([text])
        return results[0]

    # ── Text Generation ─────────────────────────────────────────────

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> str:
        """Generate text using Llama 4 Scout (or specified model)."""
        model_name = model or self.TEXT_MODEL
        url = f"{model_name}"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        try:
            resp = await self.client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

            if not data.get("success", False):
                errors = data.get("errors", [])
                err_msg = "; ".join(str(e) for e in errors)
                raise Exception(f"Cloudflare AI generation failed: {err_msg}")

            result = data["result"]
            # Workers AI returns {"response": "..."} for text gen
            if isinstance(result, dict) and "response" in result:
                return result["response"]
            elif isinstance(result, str):
                return result
            else:
                logger.warning("Unexpected text gen response shape: %s", type(result))
                return str(result)

        except Exception as e:
            logger.error("Text generation failed: %s", e)
            raise

    async def generate_with_context(
        self,
        prompt: str,
        context_chunks: List[str],
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> str:
        """Generate text with retrieved context chunks (RAG)."""
        context_text = "\n\n---\n\n".join(
            f"[SOURCE {i+1}]:\n{chunk}" for i, chunk in enumerate(context_chunks)
        )

        full_prompt = f"""You are answering based on the following source documents. 
Only use information from the provided sources. If the sources don't contain 
enough information, say so clearly — do not fabricate.

SOURCES:
{context_text}

QUESTION/PROMPT:
{prompt}

ANSWER (with citations to SOURCE numbers where applicable):"""

        return await self.generate(
            prompt=full_prompt,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            temperature=0.2,
        )

    # ── Health ───────────────────────────────────────────────────────

    async def check_health(self) -> Dict[str, Any]:
        """Check Cloudflare AI availability."""
        url = "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/models/search".format(
            account_id=self.account_id
        )
        try:
            resp = await httpx.AsyncClient().get(
                url,
                headers={"Authorization": f"Bearer {self.api_token}"},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            model_count = len(data.get("result", [])) if data.get("success") else 0
            return {
                "status": "ok",
                "account_id": self.account_id[:8] + "...",
                "available_models": model_count,
                "embedding_model": self.EMBEDDING_MODEL,
                "text_model": self.TEXT_MODEL,
                "embedding_dim": self.EMBEDDING_DIM,
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}


# Singleton — initialized at app startup with env vars
cloudflare_ai: CloudflareAI | None = None


def init_cloudflare(account_id: str, api_token: str) -> CloudflareAI:
    global cloudflare_ai
    cloudflare_ai = CloudflareAI(account_id=account_id, api_token=api_token)
    return cloudflare_ai


def get_cloudflare() -> CloudflareAI:
    if cloudflare_ai is None:
        raise RuntimeError("CloudflareAI not initialized — call init_cloudflare() first")
    return cloudflare_ai
