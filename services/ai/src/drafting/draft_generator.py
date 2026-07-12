"""Style-exemplar draft generation — M3 module.

Produces template-based drafts in email, memo, and report formats with
a professional legal/business voice. Style is influenced by optional
tone examples.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4


class DraftGenerator:
    """Generate professional legal/business drafts with firm-appropriate tone."""

    # ── Tone profiles ───────────────────────────────────────────

    TONE_PROFILES = {
        "formal": {
            "greeting": "Dear {recipient},",
            "closing": "Sincerely,\n{signature}",
            "style": "formal, precise, and legally appropriate",
        },
        "conversational": {
            "greeting": "Hi {recipient},",
            "closing": "Best regards,\n{signature}",
            "style": "professional but approachable",
        },
        "direct": {
            "greeting": "{recipient},",
            "closing": "Regards,\n{signature}",
            "style": "concise and direct, without unnecessary formalities",
        },
    }

    async def generate(
        self,
        draft_type: str,
        instructions: str,
        matter_id: Optional[str] = None,
        tone_examples: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Generate a draft document.

        Args:
            draft_type: "email", "memo", or "report"
            instructions: What the draft should contain.
            matter_id: Optional matter identifier.
            tone_examples: Optional tone reference texts.

        Returns:
            Dict with draft_id, content, model_used, draft_type.
        """
        draft_id = f"DR-{uuid4().hex[:12].upper()}"

        # Detect tone from examples
        tone_profile = self._detect_tone(tone_examples or [])

        # Generate the appropriate document type
        if draft_type == "email":
            content = self._generate_email(instructions, tone_profile)
        elif draft_type == "memo":
            content = self._generate_memo(instructions, matter_id, tone_profile)
        elif draft_type == "report":
            content = self._generate_report(instructions, matter_id, tone_profile)
        else:
            raise ValueError(
                f"Unsupported draft type: '{draft_type}'. "
                "Use 'email', 'memo', or 'report'."
            )

        return {
            "draft_id": draft_id,
            "content": content,
            "model_used": "draft_generator/stub",
            "draft_type": draft_type,
        }

    def _generate_email(
        self,
        instructions: str,
        tone: Dict[str, str],
    ) -> str:
        """Generate a formal email draft."""
        now = datetime.now().strftime("%B %d, %Y")
        subject = self._derive_subject(instructions)

        lines = [
            f"Date: {now}",
            "To: [Recipient]",
            "From: [Sender]",
            f"Subject: {subject}",
            "",
            tone["greeting"].format(recipient="[Recipient Name]"),
            "",
            f"I am writing regarding {instructions.rstrip('.')}.",
            "",
            self._email_body_section(instructions, tone),
            "",
            "Please do not hesitate to reach out if you have any questions "
            "or would like to discuss further.",
            "",
            tone["closing"].format(signature="[Your Name]\n[Title] | [Firm Name]"),
        ]

        return "\n".join(lines)

    def _generate_memo(
        self,
        instructions: str,
        matter_id: Optional[str],
        tone: Dict[str, str],
    ) -> str:
        """Generate a structured legal memo."""
        now = datetime.now().strftime("%B %d, %Y")

        lines = [
            "=" * 60,
            "CONFIDENTIAL — ATTORNEY-CLIENT PRIVILEGED",
            "=" * 60,
            "",
            "MEMORANDUM",
            "",
            f"TO:       [Recipient]",
            f"FROM:     [Author]",
            f"DATE:     {now}",
            f"RE:       {self._derive_subject(instructions)}",
        ]

        if matter_id:
            lines.append(f"MATTER:   {matter_id}")

        lines.extend([
            "",
            "-" * 60,
            "",
            "I.  EXECUTIVE SUMMARY",
            "",
            f"This memorandum addresses {instructions.rstrip('.')}. "
            "The key findings and recommendations are set forth below.",
            "",
            "II.  BACKGROUND",
            "",
            self._memo_background(instructions),
            "",
            "III.  ANALYSIS",
            "",
            self._memo_analysis(instructions, tone),
            "",
            "IV.  RECOMMENDATIONS",
            "",
            self._memo_recommendations(instructions),
            "",
            "V.  CONCLUSION",
            "",
            f"Based on the foregoing analysis, we recommend proceeding "
            f"in accordance with the above recommendations. We remain "
            f"available to discuss any aspect of this memorandum.",
            "",
            "[Author Name]",
            "[Date]",
        ])

        return "\n".join(lines)

    def _generate_report(
        self,
        instructions: str,
        matter_id: Optional[str],
        tone: Dict[str, str],
    ) -> str:
        """Generate a formal report with executive summary format."""
        now = datetime.now().strftime("%B %d, %Y")

        lines = [
            "=" * 60,
            f"REPORT: {self._derive_subject(instructions)}",
            "=" * 60,
            "",
            f"Date: {now}",
        ]

        if matter_id:
            lines.append(f"Matter: {matter_id}")

        lines.extend([
            f"Prepared by: [Author Name]",
            "",
            "-" * 60,
            "",
            "EXECUTIVE SUMMARY",
            "",
            f"This report examines {instructions.rstrip('.')}. "
            "The findings, analysis, and recommendations are organized "
            "as follows.",
            "",
            "1.  BACKGROUND AND SCOPE",
            "",
            f"The scope of this report encompasses {instructions.rstrip('.')} "
            "The analysis is based on currently available information and "
            "may be supplemented as additional facts become available.",
            "",
            "2.  KEY FINDINGS",
            "",
            self._report_findings(instructions),
            "",
            "3.  DETAILED ANALYSIS",
            "",
            self._report_analysis(instructions, tone),
            "",
            "4.  RISK ASSESSMENT",
            "",
            self._report_risk_assessment(instructions),
            "",
            "5.  RECOMMENDATIONS",
            "",
            self._report_recommendations(instructions),
            "",
            "6.  NEXT STEPS",
            "",
            "1. Review this report with stakeholders.",
            "2. Confirm next course of action.",
            "3. Schedule follow-up within [timeframe].",
            "",
            "7.  CONCLUSION",
            "",
            "This report represents our best assessment based on the "
            "information available. We recommend the actions outlined "
            "above and stand ready to assist with implementation.",
            "",
            "-" * 60,
            "[Author Name] | [Title]",
            "[Firm Name]",
            f"[Date: {now}]",
        ])

        return "\n".join(lines)

    # ── Helper methods ──────────────────────────────────────────

    @staticmethod
    def _detect_tone(tone_examples: List[str]) -> Dict[str, str]:
        """Determine tone based on provided examples."""
        if not tone_examples:
            return DraftGenerator.TONE_PROFILES["formal"]

        combined = " ".join(tone_examples).lower()
        if any(w in combined for w in ["best regards", "thanks", "hi ", "hello"]):
            return DraftGenerator.TONE_PROFILES["conversational"]
        if any(w in combined for w in ["regards", "briefly", "short", "quick note"]):
            return DraftGenerator.TONE_PROFILES["direct"]
        return DraftGenerator.TONE_PROFILES["formal"]

    @staticmethod
    def _derive_subject(instructions: str) -> str:
        """Extract a meaningful subject line from instructions."""
        clean = re.sub(r"[^\w\s-]", "", instructions).strip()
        words = clean.split()
        if len(words) <= 8:
            return clean[:80]
        return " ".join(words[:8]) + "..."

    @staticmethod
    def _email_body_section(instructions: str, tone: Dict[str, str]) -> str:
        """Generate the body of a legal email."""
        key_points = DraftGenerator._extract_key_points(instructions)
        paragraphs = [
            f"Specifically, this {tone['style']} communication addresses "
            f"the following:",
            "",
        ]
        for i, point in enumerate(key_points, 1):
            paragraphs.append(f"  {i}. {point}")
        if not key_points:
            paragraphs.append(
                "The relevant details are as set out above. "
                "We recommend taking the following steps to address this matter."
            )
        return "\n".join(paragraphs)

    @staticmethod
    def _memo_background(instructions: str) -> str:
        """Generate the background section of a memo."""
        return (
            f"This memorandum has been prepared in response to a request to "
            f"analyze matters concerning {instructions.rstrip('.')}. "
            f"The relevant factual background has been reviewed, and applicable "
            f"legal and commercial principles have been considered."
        )

    @staticmethod
    def _memo_analysis(instructions: str, tone: Dict[str, str]) -> str:
        """Generate the analysis section of a memo."""
        key_points = DraftGenerator._extract_key_points(instructions)
        sections = []
        letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

        for i, point in enumerate(key_points[:5]):
            letter = letters[i] if i < len(letters) else str(i)
            sections.append(
                f"A.  Regarding {point[:60]}...\n\n"
                f"    Based on our review, the following considerations apply: "
                f"[analysis to be completed based on specific facts]. "
                f"The applicable standard requires careful assessment of "
                f"the relevant factors, including but not limited to the "
                f"parties' intentions, industry practice, and governing law."
            )

        if not sections:
            sections.append(
                "The analysis requires a detailed review of the underlying "
                "facts and applicable legal framework. Pending further "
                "information, our preliminary assessment is as set out in "
                "the Recommendations section below."
            )

        return "\n\n".join(sections)

    @staticmethod
    def _memo_recommendations(instructions: str) -> str:
        """Generate the recommendations section of a memo."""
        return (
            "1. Conduct a thorough review of all relevant documents and "
            "communications.\n\n"
            "2. Identify and assess key contractual obligations and risks.\n\n"
            "3. Determine the most advantageous negotiating position.\n\n"
            f"4. Prepare necessary documentation to address {instructions[:60]}..."
        )

    @staticmethod
    def _report_findings(instructions: str) -> str:
        """Generate findings for a report."""
        key_points = DraftGenerator._extract_key_points(instructions)
        findings = []
        for i, point in enumerate(key_points, 1):
            findings.append(
                f"Finding {i}: Analysis of {point[:60]}... indicates "
                f"that [details to be confirmed]. Preliminary assessment "
                f"suggests moderate-to-significant impact on the overall matter."
            )
        if not findings:
            findings = [
                "Finding 1: Initial review has been completed. Further analysis "
                "is required to confirm material conclusions.",
                "Finding 2: Preliminary indicators suggest areas requiring "
                "immediate attention have been identified.",
            ]
        return "\n\n".join(findings)

    @staticmethod
    def _report_analysis(instructions: str, tone: Dict[str, str]) -> str:
        """Generate detailed analysis for a report."""
        return (
            f"Our analysis follows a structured methodology: "
            f"(1) identification of relevant issues, "
            f"(2) evaluation against applicable standards, "
            f"(3) risk assessment, and "
            f"(4) development of actionable recommendations. "
            f"\n\nEach stage of this analysis has been informed by "
            f"industry best practices and relevant precedent. "
            f"The {tone['style']} approach taken here is designed "
            f"to provide clear, actionable guidance."
        )

    @staticmethod
    def _report_risk_assessment(instructions: str) -> str:
        """Generate risk assessment for a report."""
        return (
            "Risk Level  |  Description  |  Mitigation\n"
            "-------------|---------------|-------------\n"
            "HIGH         |  [Material risk identified]  |  Immediate action required\n"
            "MEDIUM       |  [Moderate risk identified]  |  Monitor and address\n"
            "LOW          |  [Low-level concern]         |  Standard practice suffices\n\n"
            "Note: Risk levels are preliminary and should be validated against "
            "specific factual circumstances."
        )

    @staticmethod
    def _report_recommendations(instructions: str) -> str:
        """Generate recommendations for a report."""
        return (
            "Based on the foregoing analysis, we recommend:\n\n"
            "1. Immediate action on high-risk items identified above.\n"
            "2. Further investigation into medium-risk areas.\n"
            "3. Establishment of a regular review cadence.\n"
            f"4. Documentation of all decisions relating to {instructions[:60]}..."
        )

    @staticmethod
    def _extract_key_points(instructions: str) -> List[str]:
        """Extract key points from instructions."""
        # Split on numbered items, bullet points, or newlines
        points = re.split(r"[,;](?:\\n|\s)*(?=the|a |an |this |these |our )", instructions, maxsplit=3)
        points = [p.strip().capitalize() for p in points if len(p.strip()) > 5]
        if len(points) <= 1:
            # Try splitting on common delimiters
            points = re.split(r"[.;]\s+", instructions)
            points = [p.strip().capitalize() for p in points if len(p.strip()) > 5]
        return points[:5]  # Max 5 key points


draft_generator = DraftGenerator()
