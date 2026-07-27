# ADR-001: Tool Calling via Cloudflare Workers AI Bridge

**Status:** Accepted  
**Date:** 2026-07-25  
**Author:** Counsel AI Agent System Audit

---

## Context

The Counsel platform uses CrewAI for multi-agent orchestration across 7 crews / 15 agents. Several agents (FinancialModeler, CitationValidator, ComplianceChecker, LegalResearcher) need access to real computation and lookup capabilities — not just LLM text generation — to fulfill their roles:

- **FinancialModeler** needs NPV, IRR, and sensitivity calculations (not LLM-estimated numbers)
- **CitationValidator** needs citation format validation (Bluebook structure)
- **ComplianceChecker** needs a maintained rules table (not training-data knowledge)
- **LegalResearcher** needs live pgvector retrieval during task execution

CrewAI supports tool calling via `Agent(tools=[...])` with `BaseTool` instances, but the underlying LLM bridge (`CloudflareLLM`) had no function-calling support — the `tools` parameter was accepted by `call()` but ignored in `_build_payload()`.

---

## Decision

Build a **dual-mode tool-calling bridge** in `CloudflareLLM`:

1. **Native mode** (for Llama 4 Scout 17B, Llama 3.3 70B): Forward tool definitions as Cloudflare Workers AI function-calling payload, parse `tool_calls` from the response.

2. **Prompt-injection fallback** (for DeepSeek R1 and future non-native models): Inject tool schemas into the system prompt and parse the structured JSON from the LLM's response.

Also: **Do NOT wire tools through CrewAI's `Agent(tools=[])` interface.** Instead, pass tools directly to `CloudflareLLM(tools=[...])` at LLM construction time, avoiding CrewAI's `BaseTool` validation and keeping tool-calling control in the bridge layer.

### Why not CrewAI `BaseTool` wrapping?

CrewAI 1.15.2's `Agent(tools=[...])` expects `BaseTool` instances which require decorator wrapping (`@tool(...)`). This adds indirection and makes testing harder. By passing tools through the LLM bridge directly, we:
- Keep tool definitions as plain Python functions (testable, debuggable)
- Control tool dispatch in `call()` without CrewAI mediation
- Avoid `BaseTool` validation errors when tool signatures don't match CrewAI's expectations

---

## Tool Scope & Boundaries

Each tool has a **defined verification scope** — what it actually checks vs. what it explicitly does NOT check:

| Tool | Checks | Does NOT Check | Why |
|---|---|---|---|
| `retrieval_search` | Semantic pgvector search | Source authority/recency | Authority scoring needs a curated legal graph |
| `compliance_lookup` | Rule table match by category/keyword | Regulatory correctness | Rules table is maintained separately; tool only queries |
| `document_reader` | File existence + content retrieval | Document authenticity | Filesystem-level; no cryptographic verification |
| (Future) `citation_format` | Bluebook structural pattern | Case/statute existence | Needs paid legal API (Westlaw/Casetext/CourtListener) |
| (Future) `financial_calculator` | NPV/IRR/payback from cash flows | Model assumptions validity | Math is objective; business assumptions are not |

---

## Consequences

### Positive
- LLM outputs for verification agents are now grounded in real data, not hallucinated
- Tool calling works on both native-function-calling models and older models
- Bridge-level control means tools are testable without running a full CrewAI crew
- `compliance_rules.json` can be updated by the compliance team without code deploys

### Negative
- `supports_function_calling()` must return `False` to prevent CrewAI's Pydantic parser from conflicting with the bridge's tool-call response format
- Native tool calling on Cloudflare Workers AI is not supported on all models (e.g., DeepSeek R1)
- Prompt-injection fallback is fragile — if the LLM doesn't output the expected `{"tool_call": ...}` format, dispatch fails silently

### Risks
- If Cloudflare changes the function-calling API shape, `_build_payload()` and `_serialize_tool_calls()` need updates
- Prompt-injection could be misused for prompt injection attacks — current mitigation: tools run locally (no remote execution), and tool names are whitelisted

---

## Alternatives Considered

1. **CrewAI `BaseTool` wrapping** — Rejected: adds decorator overhead, validation issues with function signatures, harder to test
2. **Separate tool-execution service** — Rejected: over-engineering for MVP; adds network latency for simple lookups
3. **Hybrid: CrewAI BaseTool + bridge** — Considered but rejected: two tool-calling paths increase maintenance burden

---

## Migration Plan

- Phase 1 (done): Bridge support in `CloudflareLLM._build_payload()` + `call()`
- Phase 2 (done): Tool definitions in `tools.py` + `compliance_rules.json`
- Phase 3 (future): Add `numpy-financial` dependency for real NPV/IRR computation
- Phase 4 (future): Add citation existence verification via CourtListener API (free tier)
- Phase 5 (future): Migrate to Cloudflare Workers AI's native function calling if/when it supports all models
