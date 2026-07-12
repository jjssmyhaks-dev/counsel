"""SentenceTransformer embedding wrapper."""
from __future__ import annotations

from typing import List

from sentence_transformers import SentenceTransformer

from ..config import settings


class Embedder:
    """Local embedding model via SentenceTransformers.

    Uses all-MiniLM-L6-v2 by default (384-dim, fast, no API key needed).
    """

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or settings.embedding_model
        self._model: SentenceTransformer | None = None

    @property
    def model(self) -> SentenceTransformer:
        """Lazy-load the model on first access."""
        if self._model is None:
            self._model = SentenceTransformer(self.model_name)
        return self._model

    @property
    def dim(self) -> int:
        """Return embedding dimension."""
        return self.model.get_sentence_embedding_dimension() or settings.embedding_dim

    def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []
        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return embeddings.tolist()

    def embed_query(self, text: str) -> List[float]:
        """Generate a single query embedding."""
        result = self.model.encode(
            [text],
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return result[0].tolist()

    def embed_batch(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """Generate embeddings in batches to control memory."""
        all_embeddings: List[List[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            embeddings = self.model.encode(
                batch,
                normalize_embeddings=True,
                batch_size=batch_size,
                show_progress_bar=False,
            )
            all_embeddings.extend(embeddings.tolist())
        return all_embeddings


embedder = Embedder()
