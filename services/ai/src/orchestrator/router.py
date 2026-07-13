"""
Router Agent — classifies user intent and dispatches to the correct AI module.

This is the entry point: every user request hits the router first,
which determines what kind of work needs to be done and which agents to invoke.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


class Intent(str, Enum):
    CONTRACT_REVIEW = "contract_review"
    CLAUSE_EXTRACTION = "clause_extraction"
    DOCUMENT_COMPARISON = "document_comparison"
    RESEARCH_SYNTHESIS = "research_synthesis"
    DRAFT_GENERATION = "draft_generation"
    KNOWLEDGE_QUERY = "knowledge_query"
    MEETING_PROCESSING = "meeting_processing"
    DOCUMENT_INGESTION = "document_ingestion"
    GENERAL_QNA = "general_qna"
    UNKNOWN = "unknown"


@dataclass
class RoutingDecision:
    intent: Intent
    confidence: float  # 0.0 to 1.0
    reasoning: str
    required_agents: List[str]
    parameters: Dict[str, Any] = field(default_factory=dict)


class RouterAgent:
    """
    Classifies incoming user prompts into one of 10 intents,
    then determines which agents and parameters are needed.
    """

    INTENT_PATTERNS: Dict[Intent, List[str]] = {
        Intent.CONTRACT_REVIEW: [
            "review", "analyze", "check", "audit", "examine",
            "risk", "red flag", "redline", "due diligence",
            "contract analysis", "document review",
        ],
        Intent.CLAUSE_EXTRACTION: [
            "extract", "clause", "provision", "section",
            "find", "locate", "identify", "list",
            "indemnif", "liability", "termination", "confidential",
        ],
        Intent.DOCUMENT_COMPARISON: [
            "compare", "diff", "difference", "versus", "vs",
            "side by side", "redline", "track changes",
            "version", "amendment", "changes from",
        ],
        Intent.RESEARCH_SYNTHESIS: [
            "research", "synthesize", "brief", "summary",
            "findings", "sources", "literature", "precedent",
            "gather", "compile", "consolidate",
        ],
        Intent.DRAFT_GENERATION: [
            "draft", "write", "compose", "create",
            "email", "memo", "letter", "report",
            "generate", "prepare", "template",
        ],
        Intent.KNOWLEDGE_QUERY: [
            "how do we", "what is our", "standard", "policy",
            "precedent", "past", "previous", "usually",
            "firm", "internal", "knowledge", "playbook",
            "what's our", "firm's", "our approach", "our position",
        ],
        Intent.MEETING_PROCESSING: [
            "meeting", "call", "transcript", "minutes",
            "action item", "decision", "recording",
            "zoom", "teams",
        ],
        Intent.DOCUMENT_INGESTION: [
            "upload", "ingest", "import", "process",
            "scan", "ocr", "parse", "index",
            "add document", "new document",
        ],
        Intent.GENERAL_QNA: [
            "what", "why", "how", "explain", "describe",
            "tell me", "who", "when", "where",
        ],
    }

    def __init__(self):
        # Intent chain rules: when one intent naturally flows into another
        self.chain_rules: Dict[Intent, List[Intent]] = {
            Intent.CONTRACT_REVIEW: [Intent.CLAUSE_EXTRACTION],
            Intent.DOCUMENT_COMPARISON: [Intent.CLAUSE_EXTRACTION],
            Intent.DRAFT_GENERATION: [Intent.KNOWLEDGE_QUERY],
            Intent.RESEARCH_SYNTHESIS: [Intent.DOCUMENT_INGESTION],
            Intent.MEETING_PROCESSING: [],
            Intent.DOCUMENT_INGESTION: [],
            Intent.GENERAL_QNA: [Intent.KNOWLEDGE_QUERY],
        }

    def route(self, prompt: str, context: Optional[Dict[str, Any]] = None) -> RoutingDecision:
        """
        Classify the user's intent and decide which agents to invoke.

        Args:
            prompt: The user's natural language request
            context: Optional context (matter_id, document_ids, user role, etc.)

        Returns:
            RoutingDecision with intent, confidence, required agents, and parameters
        """
        prompt_lower = prompt.lower()
        scored_intents: Dict[Intent, int] = {}

        for intent, patterns in self.INTENT_PATTERNS.items():
            score = 0
            for pattern in patterns:
                if pattern in prompt_lower:
                    # Keyword matches in intent-specific patterns get higher weight
                    if intent in (
                        Intent.CONTRACT_REVIEW,
                        Intent.CLAUSE_EXTRACTION,
                        Intent.DRAFT_GENERATION,
                        Intent.MEETING_PROCESSING,
                    ):
                        score += 3
                    else:
                        score += 2
            if score > 0:
                scored_intents[intent] = score

        if not scored_intents:
            # Default to general Q&A or knowledge query for firm context
            if any(kw in prompt_lower for kw in ["firm", "our", "internal", "standard"]):
                return RoutingDecision(
                    intent=Intent.KNOWLEDGE_QUERY,
                    confidence=0.6,
                    reasoning="No specific intent matched; defaulting to knowledge query based on firm context keywords.",
                    required_agents=["retriever", "generator"],
                )
            return RoutingDecision(
                intent=Intent.GENERAL_QNA,
                confidence=0.5,
                reasoning="No specific intent could be determined from the prompt.",
                required_agents=["generator"],
            )

        # Pick the highest-scoring intent
        best_intent = max(scored_intents, key=scored_intents.get)
        max_score = scored_intents[best_intent]
        total_score = sum(scored_intents.values())
        confidence = min(0.95, max_score / total_score) if total_score > 0 else 0.5

        # Determine required agents and parameters
        agents, params = self._resolve_agents(best_intent, prompt, context)

        reasoning = f"Matched intent '{best_intent.value}' with {max_score} keyword hits out of {total_score} total signals."

        return RoutingDecision(
            intent=best_intent,
            confidence=confidence,
            reasoning=reasoning,
            required_agents=agents,
            parameters=params,
        )

    def _resolve_agents(
        self, intent: Intent, prompt: str, context: Optional[Dict[str, Any]]
    ) -> tuple[List[str], Dict[str, Any]]:
        """Map intent to the specific agents and parameters needed."""
        params: Dict[str, Any] = {}

        if intent == Intent.CONTRACT_REVIEW:
            agents = ["clause_extractor", "playbook_evaluator"]
            if context and "document_id" in context:
                params["document_id"] = context["document_id"]
            if context and "playbook_id" in context:
                params["playbook_id"] = context["playbook_id"]

        elif intent == Intent.CLAUSE_EXTRACTION:
            agents = ["clause_extractor"]
            if context and "clause_types" in context:
                params["clause_types"] = context["clause_types"]

        elif intent == Intent.DOCUMENT_COMPARISON:
            agents = ["parser", "chunker", "clause_extractor", "playbook_evaluator"]
            if context:
                params.update({k: context[k] for k in ("document_id", "compare_document_id") if k in context})

        elif intent == Intent.RESEARCH_SYNTHESIS:
            agents = ["retriever", "research_synthesizer"]
            if context and "matter_id" in context:
                params["matter_id"] = context["matter_id"]

        elif intent == Intent.DRAFT_GENERATION:
            agents = ["retriever", "draft_generator"]
            if context and "matter_id" in context:
                params["matter_id"] = context["matter_id"]

        elif intent == Intent.KNOWLEDGE_QUERY:
            agents = ["retriever", "generator"]
            if context and "matter_id" in context:
                params["matter_id"] = context["matter_id"]

        elif intent == Intent.MEETING_PROCESSING:
            agents = ["meeting_processor"]

        elif intent == Intent.DOCUMENT_INGESTION:
            agents = ["parser", "chunker", "embedder", "retriever"]

        elif intent == Intent.GENERAL_QNA:
            agents = ["generator"]

        else:
            agents = ["generator"]

        # Always include quality gate and audit for safety
        agents.extend(["quality_gate", "audit_trail"])

        params["original_prompt"] = prompt
        return agents, params
