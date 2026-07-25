"""Pydantic output schemas for all CrewAI tasks.

Each model corresponds to the expected_output of a task. Wiring these
into Task(..., output_pydantic=<Model>) gives CrewAI structured validation
and avoids free-text parsing downstream.

Architecture:
  - C1 Document Intelligence: ClauseList → RiskMatrix → PlaybookReport
  - C2 Drafting: DraftDocument → CitationReport
  - C3 Research: ResearchFindings → LegalMemorandum
  - C4 Compliance: ComplianceReport → NegotiationPlaybook
  - C5 Proposal: RFPAnalysis → ProposalDocument → FinancialModel
  - C6 Market Intel: MarketResearch → StrategyDocument
  - C7 Engagement: EngagementStructure → StatusReport
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════
# C1: DOCUMENT INTELLIGENCE SCHEMAS
# ═══════════════════════════════════════════════════════════════

class Clause(BaseModel):
    clause_type: str = Field(..., description="Type of clause (e.g., Indemnification)")
    text_excerpt: str = Field(..., description="Extracted text of the clause")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0-1")
    observations: str = Field("", description="Notable observations about this clause")


class ClauseList(BaseModel):
    document_summary: str = Field(..., description="Brief overview of the document")
    clauses: List[Clause] = Field(default_factory=list, description="Extracted clauses")
    missing_clause_types: List[str] = Field(default_factory=list, description="Standard clause types not found")


class RiskItem(BaseModel):
    clause_type: str = Field(..., description="Type of clause being scored")
    risk_score: float = Field(..., ge=1.0, le=10.0, description="Risk score 1-10")
    rationale: str = Field(..., description="Legal reasoning for the score")
    financial_exposure_estimate: str = Field("", description="Estimated financial impact")
    market_standard_comparison: str = Field("", description="How this compares to market standards")


class RiskMatrix(BaseModel):
    overall_risk_score: float = Field(..., ge=1.0, le=10.0, description="Aggregate risk score")
    risk_breakdown: List[RiskItem] = Field(default_factory=list, description="Per-clause risk assessment")
    critical_issues: List[str] = Field(default_factory=list, description="Clauses with risk >= 7 needing immediate attention")
    negotiation_priority: List[str] = Field(default_factory=list, description="Ordered list of what to negotiate first")


class ComplianceDetail(BaseModel):
    rule_name: str = Field(..., description="Name of the playbook rule")
    status: str = Field(..., description="PASS / VIOLATION / MISSING")
    actual_value: Optional[str] = Field(None, description="What the contract says")
    required_value: Optional[str] = Field(None, description="What the playbook requires")
    deviation: Optional[str] = Field(None, description="How much it deviates")
    recommended_action: Optional[str] = Field(None, description="What to do about it")


class PlaybookReport(BaseModel):
    compliance_summary: str = Field(..., description="Total rules, passed, violations, missing")
    compliance_details: List[ComplianceDetail] = Field(default_factory=list)
    critical_violations: List[str] = Field(default_factory=list, description="Showstopper violations")
    negotiation_playbook: List[str] = Field(default_factory=list, description="Counter-position language per violation")


# ═══════════════════════════════════════════════════════════════
# C2: DRAFTING SCHEMAS
# ═══════════════════════════════════════════════════════════════

class DraftDocument(BaseModel):
    draft_content: str = Field(..., description="The full draft text with proper formatting")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="draft_type, word_count, sections_count")
    placeholders: List[str] = Field(default_factory=list, description="[BRACKETED] items needing attorney input")
    tone_notes: str = Field("", description="How the draft matches the reference tone")


class CitationResult(BaseModel):
    text: str = Field(..., description="The citation text as found")
    format_check: str = Field(..., description="PASS / NEEDS_FIX / INVALID")
    verifiability: str = Field(..., description="VERIFIED / UNVERIFIABLE / FABRICATED")
    notes: str = Field("", description="Additional observations")


class CitationReport(BaseModel):
    citations_found: List[CitationResult] = Field(default_factory=list)
    fabricated_citations: List[str] = Field(default_factory=list, description="Citations that cannot be verified")
    suggested_improvements: List[str] = Field(default_factory=list, description="Better citations to use instead")


# ═══════════════════════════════════════════════════════════════
# C3: RESEARCH SCHEMAS
# ═══════════════════════════════════════════════════════════════

class SubQuestionFinding(BaseModel):
    sub_question: str = Field(..., description="The sub-question")
    answer: str = Field(..., description="Answer found in sources")
    source_refs: List[str] = Field(default_factory=list, description="Source IDs referenced")
    confidence: str = Field(..., description="HIGH / MEDIUM / LOW")


class ResearchFindings(BaseModel):
    question_decomposition: List[str] = Field(default_factory=list, description="Sub-questions identified")
    findings: List[SubQuestionFinding] = Field(default_factory=list)
    key_authorities: List[str] = Field(default_factory=list, description="Most important sources")
    gaps: List[str] = Field(default_factory=list, description="Questions the sources could not answer")
    jurisdiction_notes: str = Field("", description="Jurisdiction-specific observations")


class SourceRef(BaseModel):
    citation_id: str = Field(..., description="Citation ID used in document body")
    full_reference: str = Field(..., description="Full source reference string")
    confidence_level: str = Field(..., description="DIRECT_QUOTE / PARAPHRASED / INFERRED")


class LegalMemorandum(BaseModel):
    title: str = Field(..., description="Memorandum title")
    executive_summary: str = Field(..., description="2-3 paragraph high-level answer")
    legal_framework: str = Field(..., description="Applicable statutes, rules, standards")
    analysis: str = Field(..., description="Detailed answer with citations to sources")
    open_questions: List[str] = Field(default_factory=list, description="Uncertainties and further research needed")
    recommendations: List[str] = Field(default_factory=list, description="Practical next steps")
    source_index: List[SourceRef] = Field(default_factory=list, description="Full source references")
    metadata: Dict[str, str] = Field(default_factory=dict, description="Title, date, jurisdiction")


# ═══════════════════════════════════════════════════════════════
# C4: COMPLIANCE SCHEMAS
# ═══════════════════════════════════════════════════════════════

class FrameworkResult(BaseModel):
    framework: str = Field(..., description="e.g., SOC2, ISO27001, GDPR, CCPA")
    status: str = Field(..., description="PASS / NEEDS_REVIEW / FAIL")
    findings: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


class ComplianceReport(BaseModel):
    overall_status: str = Field(..., description="PASS / NEEDS_REVIEW / FAIL")
    framework_results: List[FrameworkResult] = Field(default_factory=list)
    flagged_concerns: List[str] = Field(default_factory=list, description="Specific issues needing attention")
    data_privacy_notes: str = Field("", description="GDPR/CCPA specific observations")
    remediation_steps: List[str] = Field(default_factory=list, description="How to fix identified issues")


class IssueGuidance(BaseModel):
    clause_type: str = Field(..., description="Which clause this guidance covers")
    opening_position: str = Field(..., description="Strongest argument to start with")
    fallback_position: str = Field(..., description="Acceptable compromise")
    walkaway_point: str = Field(..., description="When to refuse and escalate")
    market_data: str = Field("", description="What % of similar deals accept this position")
    negotiation_tactic: str = Field("", description="Specific technique to use")


class NegotiationPlaybook(BaseModel):
    strategy_summary: str = Field(..., description="Overall negotiation approach")
    per_issue_guidance: List[IssueGuidance] = Field(default_factory=list)
    priority_order: List[str] = Field(default_factory=list, description="Which issues to negotiate first")
    leverage_points: List[str] = Field(default_factory=list, description="Areas of strength")
    risk_escalation_triggers: List[str] = Field(default_factory=list, description="When to involve senior partners")


# ═══════════════════════════════════════════════════════════════
# C5: PROPOSAL SCHEMAS
# ═══════════════════════════════════════════════════════════════

class RFPAnalysis(BaseModel):
    requirements_summary: str = Field(..., description="Key requirements extracted from RFP")
    ghost_criteria: List[str] = Field(default_factory=list, description="Unstated but implied needs")
    win_themes: List[str] = Field(default_factory=list, description="3-4 differentiating narratives")
    disqualifiers: List[str] = Field(default_factory=list, description="Automatic disqualification factors")
    evaluation_scorecard: str = Field("", description="How the RFP will be scored")


class ProposalDocument(BaseModel):
    executive_summary: str = Field(..., description="1-page executive summary")
    situation_assessment: str = Field(..., description="Current state analysis")
    methodology: str = Field(..., description="Phased approach with deliverables")
    team_section: str = Field(..., description="Roles and bios")
    timeline: str = Field(..., description="Gantt with milestones")
    pricing: str = Field(..., description="Aligned with budget range")
    differentiators: str = Field(..., description="Why us / past work")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FinancialModel(BaseModel):
    fee_breakdown: str = Field(..., description="Fee breakdown by phase")
    resource_plan: str = Field(..., description="Team days x rates")
    roi_projection: str = Field(..., description="3-year ROI projection")
    sensitivity_table: str = Field(..., description="Best/base/worst scenarios")
    key_metrics: str = Field(..., description="NPV, payback, BCR summary")


# ═══════════════════════════════════════════════════════════════
# C6: MARKET INTELLIGENCE SCHEMAS
# ═══════════════════════════════════════════════════════════════

class CompetitiveEntry(BaseModel):
    name: str = Field(..., description="Competitor name")
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    market_share: str = Field("", description="Estimated market share")
    positioning: str = Field("", description="How they position themselves")


class MarketResearch(BaseModel):
    executive_summary: str = Field(..., description="High-level findings")
    market_sizing: str = Field(..., description="TAM/SAM/SOM with growth rates")
    trends_analysis: str = Field(..., description="5-7 key trends")
    competitive_landscape: List[CompetitiveEntry] = Field(default_factory=list, description="5-8 competitors mapped")
    swot: str = Field(..., description="SWOT analysis for target company")
    growth_recommendations: List[str] = Field(default_factory=list)


class TradeOffItem(BaseModel):
    option_name: str = Field(..., description="Name of the strategic option")
    pros: List[str] = Field(default_factory=list)
    cons: List[str] = Field(default_factory=list)
    feasibility: str = Field("", description="HIGH / MEDIUM / LOW")
    time_horizon: str = Field("", description="Short / Medium / Long term")


class StrategyDocument(BaseModel):
    strategic_options: List[TradeOffItem] = Field(default_factory=list, description="3-4 strategic paths")
    trade_off_matrix: str = Field(..., description="Comparison of options")
    primary_recommendation: str = Field(..., description="Clear recommended path")
    implementation_roadmap: str = Field(..., description="90d/6m/12m roadmap")
    kpi_dashboard: str = Field(..., description="Success metrics and KPIs")
    risk_mitigation: str = Field(..., description="Key risks and mitigation strategies")


# ═══════════════════════════════════════════════════════════════
# C7: ENGAGEMENT SCHEMAS
# ═══════════════════════════════════════════════════════════════

class ResourcePlanEntry(BaseModel):
    role: str = Field(..., description="Role title")
    allocation_pct: float = Field(..., ge=0.0, le=100.0, description="Allocation percentage")
    responsibilities: List[str] = Field(default_factory=list)


class RiskRegisterEntry(BaseModel):
    risk_description: str = Field(..., description="Risk description")
    likelihood: str = Field(..., description="HIGH / MEDIUM / LOW")
    impact: str = Field(..., description="HIGH / MEDIUM / LOW")
    mitigation: str = Field("", description="Mitigation strategy")


class StakeholderEntry(BaseModel):
    name: str = Field(..., description="Stakeholder name or role")
    power: str = Field(..., description="HIGH / MEDIUM / LOW")
    interest: str = Field(..., description="HIGH / MEDIUM / LOW")
    engagement_strategy: str = Field("", description="How to manage this stakeholder")


class EngagementStructure(BaseModel):
    wbs: str = Field(..., description="Work Breakdown Structure (phases, workstreams)")
    resource_plan: List[ResourcePlanEntry] = Field(default_factory=list)
    risk_register: List[RiskRegisterEntry] = Field(default_factory=list, description="Top 10 risks")
    stakeholder_map: List[StakeholderEntry] = Field(default_factory=list, description="Power/interest grid")
    deliverable_tracker: str = Field(..., description="Deliverable list with dates")
    communication_plan: str = Field(..., description="Communication cadence and channels")


class StatusReport(BaseModel):
    executive_summary: str = Field(..., description="RAG status with 3 bullets")
    accomplishments: List[str] = Field(default_factory=list, description="This period")
    planned: List[str] = Field(default_factory=list, description="Next period")
    kpi_dashboard: str = Field(..., description="Progress %, budget burn")
    risks: str = Field(..., description="Current risks and issues")
    decisions_required: List[str] = Field(default_factory=list, description="Decisions needed from client")
