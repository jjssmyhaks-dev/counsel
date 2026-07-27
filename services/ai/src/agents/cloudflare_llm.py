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

    Supports tool/function calling by registering tool definitions at init
    or passing them per-call. When tools are provided and the model supports
    native function calling, the call() method returns structured JSON.
    Fallback: inject tool schemas into the system prompt for models that
    don't have native tool support.

    Attributes:
        model: The Cloudflare model ID (e.g. @cf/meta/llama-4-scout-17b-16e-instruct).
        api_base: Cloudflare Workers AI run endpoint URL.
        api_token: Cloudflare API token.
        tools: Optional list of tool/function definitions for tool calling.
    """

    # Models that support Cloudflare's native tool calling
    _NATIVE_TOOL_MODELS = {
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/meta/llama-4-scout-17b-16e-instruct",
    }

    def __init__(
        self,
        model: str = CF_DEFAULT_MODEL,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs,
    ):
        # Bypass pydantic field injection — set attributes directly on the internal
        # dict BEFORE calling super().__init__ so BaseLLM sees them as pre-set.
        super().__init__(model=model, **kwargs)
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self._tools = tools or []

        # Resolve Cloudflare credentials
        from ..config import settings
        self._api_token = settings.cloudflare_api_token
        self._api_base = (
            f"https://api.cloudflare.com/client/v4/accounts/"
            f"{settings.cloudflare_account_id}/ai/run/"
        )

    def supports_function_calling(self) -> bool:
        """CrewAI check for Pydantic output parsing.

        Returns False because our tool calling goes through the native
        Cloudflare Workers AI bridge (_build_payload), not through CrewAI's
        pydantic validation layer. Returning True here causes CrewAI to try
        parsing LLM output as Pydantic models which conflicts with our bridge.
        """
        return False

    def supports_stop_words(self) -> bool:
        """Required by CrewAI BaseLLM interface."""
        return False

    # ──────────────────────────── CrewAI API ────────────────────────────

    def call(
        self,
        messages: Union[str, List[Dict[str, str]]],
        tools: Optional[List[Dict[str, Any]]] = None,
        callbacks: Optional[List[Any]] = None,
        **kwargs,
    ) -> str:
        """Synchronous chat completion as required by CrewAI's BaseLLM protocol.

        When tools are provided (either at init or per-call), this method:
        1. For native-tool models: includes tools in the Cloudflare API payload
           and parses the structured tool_call response.
        2. For non-native models: injects tool schemas into the system prompt
           as context so the model can describe which tool it would call.

        This runs in whatever thread CrewAI assigns — must be fully synchronous.
        """
        active_tools = tools or self._tools
        payload = self._build_payload(messages, tools=active_tools)
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

            # Parse tool calls from response if present
            if active_tools and "tool_calls" in result:
                tool_calls_str = self._serialize_tool_calls(result["tool_calls"])
                return tool_calls_str

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
        self, messages: Union[str, List[Dict[str, str]]],
        tools: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Convert CrewAI message format to Cloudflare Workers AI format.

        Cloudflare expects: {"messages": [...], ...}
        When tools are provided, injects them for native models or as
        system-prompt context for non-native models.
        """
        import json

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

        # Tool injection for non-native models: embed schemas in system prompt
        tool_context = ""
        if tools and self.model not in self._NATIVE_TOOL_MODELS:
            tool_schemas = json.dumps(
                [{"name": t.get("name", ""), "description": t.get("description", ""),
                  "parameters": t.get("parameters", {})} for t in tools],
                indent=2,
            )
            tool_context = (
                "\n\nAVAILABLE TOOLS:\n" + tool_schemas + "\n\n"
                "If you need to use a tool, respond with a JSON object in this format:\n"
                '{"tool_call": {"name": "<tool_name>", "params": {...}}}\n'
            )

        if system_prompt:
            cf_messages.append({"role": "system", "content": system_prompt + tool_context})
        elif tool_context:
            cf_messages.append({"role": "system", "content": tool_context})
        cf_messages.extend(user_msgs)

        payload: Dict[str, Any] = {
            "messages": cf_messages,
            "max_tokens": int(self.max_tokens) if self.max_tokens else 4096,
            "temperature": float(self.temperature) if self.temperature else 0.3,
        }

        # Native tool support: pass tools directly to the API
        if tools and self.model in self._NATIVE_TOOL_MODELS:
            payload["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": t.get("name", ""),
                        "description": t.get("description", ""),
                        "parameters": t.get("parameters", {}),
                    },
                }
                for t in tools
            ]

        return payload

    @staticmethod
    def _serialize_tool_calls(tool_calls: List[Dict[str, Any]]) -> str:
        """Serialize tool call responses into a JSON string CrewAI can parse."""
        import json
        calls = []
        for tc in tool_calls:
            fn = tc.get("function", {})
            calls.append({
                "tool_call": {
                    "name": fn.get("name", ""),
                    "arguments": fn.get("arguments", {}),
                }
            })
        return json.dumps({"tool_calls": calls}, indent=2)


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
