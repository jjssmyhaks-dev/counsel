"""Embedding provider — Cloudflare Workers AI or local SentenceTransformer fallback."""
from __future__ import annotations

import logging
from typing import List

from ..config import settings

logger = logging.getLogger(__name__)


class Embedder:
    """Embedding provider.

    Primary: Cloudflare Workers AI (bge-base-en-v1.5, 768-dim)
    Fallback: local SentenceTransformer (all-MiniLM-L6-v2, 384-dim)

    Uses the singleton CloudflareAI when configured, otherwise
    falls back to local SentenceTransformer.
    """

    def __init__(self) -> None:
        self._cf = None
        self._local_model = None
        self._dim: int | None = None

    async def _init_cf(self):
        if self._cf is not None:
            return
        from ..providers.cloudflare import get_cloudflare
        try:
            self._cf = get_cloudflare()
            logger.info("Using Cloudflare Workers AI for embeddings (%s)", self._cf.EMBEDDING_MODEL)
        except RuntimeError:
            logger.info("Cloudflare not configured, using local SentenceTransformer")
            self._cf = None

    def _init_local(self):
        if self._local_model is not None:
            return
        from sentence_transformers import SentenceTransformer
        self._local_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Using local SentenceTransformer (all-MiniLM-L6-v2)")

    @property
    def dim(self) -> int:
        if self._dim is None:
            self._dim = 768 if self._cf is not None else 384
        return self._dim

    async def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []

        await self._init_cf()

        if self._cf:
            return await self._cf.embed(texts)
        else:
            self._init_local()
            embeddings = self._local_model.encode(
                texts,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            return embeddings.tolist()

    async def embed_query(self, text: str) -> List[float]:
        """Generate a single query embedding."""
        results = await self.embed([text])
        return results[0]

    async def embed_batch(self, texts: List[str], batch_size: int = 20) -> List[List[float]]:
        """Generate embeddings in batches to control memory."""
        if not texts:
            return []

        await self._init_cf()

        if self._cf:
            return await self._cf.embed(texts)  # Cloudflare handles batching internally

        self._init_local()
        all_embeddings: List[List[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            embeddings = self._local_model.encode(
                batch,
                normalize_embeddings=True,
                batch_size=batch_size,
                show_progress_bar=False,
            )
            all_embeddings.extend(embeddings.tolist())
        return all_embeddings


embedder = Embedder()
