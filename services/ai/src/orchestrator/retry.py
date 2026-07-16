"""Production-grade error handling and retry for CrewAI agent calls.

Provides a retry decorator that wraps crew execution with exponential backoff,
structured error logging, and integration with the audit trail.
"""
from __future__ import annotations

import asyncio
import functools
import logging
import time
from typing import Any, Callable, Dict, TypeVar

F = TypeVar("F", bound=Callable[..., Any])

logger = logging.getLogger(__name__)

# ── Retry Configuration ──────────────────────────────────────────

RETRY_CONFIG = {
    "max_retries": 3,
    "base_delay_seconds": 2.0,
    "max_delay_seconds": 30.0,
    "exponential_base": 2.0,
    "retryable_exceptions": (
        TimeoutError,
        ConnectionError,
        OSError,
        RuntimeError,  # CrewAI wraps LLM failures in RuntimeError
    ),
}


def with_retry(
    crew_name: str,
    max_retries: int = None,
    base_delay: float = None,
):
    """Decorator: retry an async crew function with exponential backoff.

    Args:
        crew_name: Human-readable name for error messages and audit log.
        max_retries: Override default retry count.
        base_delay: Override base delay in seconds.

    Usage:
        @with_retry("document_intelligence", max_retries=3)
        async def run_document_intelligence(...):
            ...
    """
    max_retries = max_retries if max_retries is not None else RETRY_CONFIG["max_retries"]
    base_delay = base_delay if base_delay is not None else RETRY_CONFIG["base_delay_seconds"]
    retryable = RETRY_CONFIG["retryable_exceptions"]
    max_delay = RETRY_CONFIG["max_delay_seconds"]

    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            from .structured_logging import write_event

            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    start = time.time()
                    result = await func(*args, **kwargs)
                    duration_ms = int((time.time() - start) * 1000)

                    if attempt > 0:
                        write_event({
                            "event": "retry_success",
                            "crew": crew_name,
                            "attempt": attempt + 1,
                            "duration_ms": duration_ms,
                        })
                    return result

                except retryable as e:
                    last_exception = e
                    if attempt < max_retries:
                        delay = min(base_delay * (RETRY_CONFIG["exponential_base"] ** attempt), max_delay)
                        write_event({
                            "event": "retry_attempt",
                            "crew": crew_name,
                            "attempt": attempt + 1,
                            "max_retries": max_retries,
                            "delay_seconds": delay,
                            "error": str(e)[:300],
                            "error_type": type(e).__name__,
                        })
                        logger.warning(
                            "[%s] attempt %d/%d failed: %s. Retrying in %.1fs...",
                            crew_name, attempt + 1, max_retries + 1, e, delay,
                        )
                        await asyncio.sleep(delay)
                    else:
                        write_event({
                            "event": "retry_exhausted",
                            "crew": crew_name,
                            "attempts": max_retries + 1,
                            "error": str(e)[:500],
                            "error_type": type(e).__name__,
                        })
                        logger.error(
                            "[%s] all %d attempts failed: %s",
                            crew_name, max_retries + 1, e,
                        )
                except Exception as e:
                    # Non-retryable exceptions — log and re-raise immediately
                    write_event({
                        "event": "non_retryable_error",
                        "crew": crew_name,
                        "error": str(e)[:500],
                        "error_type": type(e).__name__,
                    })
                    raise

            # Should only reach here if all retries exhausted
            raise last_exception  # type: ignore[misc]

        return wrapper  # type: ignore[return-value]
    return decorator
