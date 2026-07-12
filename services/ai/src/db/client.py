"""PostgreSQL connection pool via asyncpg."""
from __future__ import annotations

import logging
from typing import Optional

import asyncpg

from ..config import settings

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Return (or create) the asyncpg connection pool."""
    global _pool
    if _pool is None:
        logger.info("Creating asyncpg connection pool...")
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_pool() -> None:
    """Close the connection pool cleanly."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("asyncpg connection pool closed.")


async def execute(sql: str, *args) -> str:
    """Execute a SQL statement and return status."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(sql, *args)


async def fetch(sql: str, *args) -> list:
    """Execute SQL and return all rows."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(sql, *args)


async def fetchrow(sql: str, *args):
    """Execute SQL and return a single row."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(sql, *args)


async def ensure_tables() -> None:
    """Ensure the required pgvector tables exist.

    Creates the pgvector extension and document_chunks table if missing.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id           TEXT PRIMARY KEY,
                document_id  TEXT NOT NULL,
                firm_id      TEXT NOT NULL,
                matter_id    TEXT,
                chunk_index  INTEGER NOT NULL,
                text         TEXT NOT NULL,
                section_title TEXT,
                page_number  INTEGER,
                embedding    vector(384),
                metadata     JSONB DEFAULT '{}'::jsonb,
                created_at   TIMESTAMPTZ DEFAULT NOW(),
                updated_at   TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
            ON document_chunks(document_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_document_chunks_firm_id
            ON document_chunks(firm_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
            ON document_chunks USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        """)
