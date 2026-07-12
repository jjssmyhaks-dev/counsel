"""Meeting transcript processor — M4 module.

Extracts structured information from meeting transcripts:
- Decisions: what was decided/agreed/approved
- Action items: tasks with owners and due dates
- Open questions: items requiring follow-up
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
from uuid import uuid4


class MeetingProcessor:
    """Process meeting transcripts to extract decisions, action items, and questions."""

    # ── Decision patterns ───────────────────────────────────────

    DECISION_PATTERNS = [
        re.compile(
            r"(?:we\s+)?(?:have\s+)?(?:decided|agreed|approved|resolved|concluded"
            r"|determined|ratified|confirmed)\s+(?:that|to|upon|on)?\s*(.+?)(?:\.|$)",
            re.IGNORECASE,
        ),
        re.compile(
            r"it\s+(?:was|is)\s+(?:decided|agreed|approved|resolved|concluded)\s+"
            r"(?:that|to|upon|on)?\s*(.+?)(?:\.|$)",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:decision|consensus)\s*(?:is|:)\s*(.+?)(?:\.|$)",
            re.IGNORECASE,
        ),
        re.compile(
            r"motion\s+(?:carried|passed|approved)[\s,.]{1,3}(.+?)(?:\.|$)",
            re.IGNORECASE,
        ),
        re.compile(
            r"everyone\s+(?:agrees|concurred|is on board)\s+(?:that|with|to)?\s*(.+?)(?:\.|$)",
            re.IGNORECASE,
        ),
    ]

    # ── Action item patterns ────────────────────────────────────

    ACTION_PATTERNS: List[re.Pattern] = [
        # "@Name will do X by Y"
        re.compile(
            r"@?(\w+(?:\s+\w+)?)\s+(?:will|shall|is going to|needs to|must|should)"
            r"\s+(.+?)(?:\.\s*|$)",
            re.IGNORECASE,
        ),
        # "Name to do X"
        re.compile(
            r"(\w+(?:\s+\w+)?)\s+(?:to|has to)\s+(.+?)(?:\.\s*|$)",
            re.IGNORECASE,
        ),
        # "Action: Name — X" / "Action item: X"
        re.compile(
            r"action(?:\s+item)?[\s:]+(?:for\s+)?(\w+(?:\s+\w+)?)?\s*[-–—:]\s*(.+?)(?:\.\s*|$)",
            re.IGNORECASE,
        ),
        # "follow up: X"
        re.compile(
            r"follow[\s-]up[\s:]+(.+?)(?:\.\s*|$)",
            re.IGNORECASE,
        ),
        # "I need X to Y"
        re.compile(
            r"(?:I|we)\s+need\s+(\w+(?:\s+\w+)?)?\s*to\s+(.+?)(?:\.\s*|$)",
            re.IGNORECASE,
        ),
        # "Task for Name: X"
        re.compile(
            r"task(?:\s+for\s+(\w+(?:\s+\w+)?))?[\s:]+(.+?)(?:\.\s*|$)",
            re.IGNORECASE,
        ),
        # "Assignee: Name" followed by task on next line
        re.compile(
            r"assign(?:ee|ed)[\s:]+(\w+(?:\s+\w+)?)(?:\s*[-–—]\s*(.+?))?(?:\.\s*|$)",
            re.IGNORECASE,
        ),
    ]

    # ── Due date patterns ───────────────────────────────────────

    DUE_DATE_PATTERNS = [
        re.compile(r"(?:by|due|deadline|complete by)\s+(\w+\s+\d+(?:st|nd|rd|th)?(?:,?\s*\d{4})?)", re.IGNORECASE),
        re.compile(r"(\d{1,2}/\d{1,2}(?:/\d{2,4})?)", re.IGNORECASE),
        re.compile(r"(?:due|by)\s+(next\s+\w+day|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)", re.IGNORECASE),
        re.compile(r"(?:by|within)\s+(\d+)\s+(day|week|month)s?", re.IGNORECASE),
        re.compile(r"by\s+(?:end\s+of\s+)?(\w+)", re.IGNORECASE),
    ]

    # ── Question patterns ────────────────────────────────────────

    QUESTION_PATTERNS = [
        re.compile(r"([^.!?\n]+\?)"),
        re.compile(r"(?:we\s+)?need\s+to\s+(?:determine|decide|figure out|clarify|verify|check|confirm|resolve)\s+(.+?)(?:\.|$)", re.IGNORECASE),
        re.compile(r"(?:still\s+)?(?:TBD|to\s+be\s+(?:determined|decided|confirmed|resolved|discussed))[\s:]*(.+?)?(?:\.|$)", re.IGNORECASE),
        re.compile(r"(?:open|remaining|unresolved|pending)\s+(?:question|issue|item)[\s:]*(.+?)(?:\.|$)", re.IGNORECASE),
        re.compile(r"not\s+yet\s+(?:decided|determined|resolved|clear|agreed)\s*(?:on\s+)?(.+?)(?:\.|$)", re.IGNORECASE),
        re.compile(r"(?:doesn't|does not|isn't|is not)\s+(?:know|clear|sure)\s*(?:about\s+)?(.+?)(?:\.|$)", re.IGNORECASE),
    ]

    # ── Common names to help with owner detection ────────────────

    COMMON_FIRST_NAMES = {
        "john", "jane", "michael", "sarah", "david", "lisa",
        "james", "emma", "robert", "olivia", "william", "ava",
        "richard", "sophia", "thomas", "isabella", "charles",
        "mia", "christopher", "charlotte", "daniel", "amelia",
        "matthew", "harper", "anthony", "evelyn", "mark", "abigail",
        "donald", "emily", "steven", "elizabeth", "paul", "sofia",
        "andrew", "avery", "joshua", "ella", "kenneth", "madison",
        "kevin", "scarlett", "brian", "victoria", "george", "aria",
        "timothy", "grace", "ronald", "chloe", "edward", "camila",
        "jason", "penelope", "jeffrey", "riley", "ryan", "layla",
        "jacob", "lillian", "gary", "nora", "nicholas", "zoey",
        "eric", "mila", "jonathan", "aubrey", "stephen", "hannah",
        "larry", "lily", "justin", "addison", "scott", "eleanor",
        "brandon", "natalie", "benjamin", "luna", "samuel", "savannah",
        "raymond", "brooklyn", "gregory", "leah", "frank", "zoe",
        "alexander", "stella", "patrick", "hazel", "jack", "ellie",
        "dennis", "paisley", "jerry", "audrey", "tyler", "skylar",
        "aaron", "violet", "jose", "claire", "adam", "bella",
        "nathan", "aurora", "henry", "lucy", "douglas", "anna",
        "zachary", "samantha", "peter", "caroline", "kyle", "genesis",
        "walter", "aaliyah", "ethan", "kennedy", "jeremy", "kinsley",
        "harold", "allison", "keith", "maya", "christian", "sarah",
        "roger", "madelyn", "noah", "adeline", "gerald", "alexa",
        "carl", "ariana", "terry", "elena", "sean", "naomi",
        "austin", "arianna", "arthur", "alice", "lawrence", "gabriella",
        "jesse", "hailey", "dylan", "isabelle", "bryan", "katherine",
        "joe", "jade", "jordan", "maria", "billy", "brianna",
        "bruce", "jocelyn", "albert", "rachel", "willie", "kaylee",
        "gabriel", "liliana", "logan", "adriana", "alan", "kylie",
        "juan", "valentina", "wayne", "annabelle", "roy", "morgan",
        "ralph", "julia", "randy", "quinn",
    }

    async def process(self, meeting_id: str, transcript: str) -> Dict[str, Any]:
        """Process a meeting transcript.

        Returns a dict with decisions, action_items, and open_questions.
        """
        # Clean transcript
        transcript = self._clean_transcript(transcript)

        # Extract
        decisions = self._extract_decisions(transcript)
        action_items = self._extract_action_items(transcript)
        open_questions = self._extract_open_questions(transcript)

        return {
            "meeting_id": meeting_id,
            "decisions": decisions,
            "action_items": action_items,
            "open_questions": open_questions,
        }

    def _clean_transcript(self, transcript: str) -> str:
        """Normalize transcript text."""
        # Remove speaker labels like "John (00:05:30):"
        text = re.sub(r"^.*?\(\d{2}:\d{2}:\d{2}\)\s*:", "", transcript, flags=re.MULTILINE)
        text = re.sub(r"^\[.*?\]\s*", "", text, flags=re.MULTILINE)
        # Remove timestamps
        text = re.sub(r"\[\d{2}:\d{2}(?::\d{2})?\]", "", text)
        text = re.sub(r"\(\d{2}:\d{2}(?::\d{2})?\)", "", text)
        # Collapse whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" +", " ", text)
        return text.strip()

    def _extract_decisions(self, transcript: str) -> List[str]:
        """Extract decisions from the transcript."""
        decisions: List[str] = []

        for pattern in self.DECISION_PATTERNS:
            for match in pattern.finditer(transcript):
                decision = match.group(1).strip()
                if decision and len(decision) > 5:
                    decision = self._clean_extracted(decision)
                    if self._is_meaningful(decision, min_length=10):
                        decisions.append(decision)

        # Deduplicate near-matches
        decisions = self._deduplicate(decisions)

        return decisions[:20]

    def _extract_action_items(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract action items with owner and due date hints."""
        items: List[Dict[str, Any]] = []

        # Strategy 1: Match action patterns
        for pattern in self.ACTION_PATTERNS:
            for match in pattern.finditer(transcript):
                groups = match.groups()
                owner = None
                task = ""

                if len(groups) == 1:
                    task = groups[0]
                elif len(groups) == 2:
                    owner, task = groups

                task = (task or "").strip()
                owner = (owner or "").strip()

                # Validate owner looks like a name
                if owner and not self._looks_like_name(owner):
                    # The "owner" might be part of the task
                    task = (owner + " " + task).strip()
                    owner = None

                if task and self._is_meaningful(task, min_length=8):
                    # Look for due dates near this action item
                    due_date = self._extract_due_date(transcript, match.start())

                    items.append({
                        "text": task,
                        "owner_hint": owner if owner else None,
                        "due_date_hint": due_date,
                    })

        # Deduplicate
        seen_texts: set = set()
        unique_items: List[Dict[str, Any]] = []
        for item in items:
            key = item["text"].lower()[:60]
            if key not in seen_texts:
                seen_texts.add(key)
                unique_items.append(item)

        return unique_items[:25]

    def _extract_open_questions(self, transcript: str) -> List[str]:
        """Extract open questions and unresolved items."""
        questions: List[str] = []

        for pattern in self.QUESTION_PATTERNS:
            for match in pattern.finditer(transcript):
                text = match.group(0).strip()
                if len(match.groups()) > 0 and match.group(1):
                    text = match.group(1).strip()

                if text and self._is_meaningful(text, min_length=6):
                    text = self._clean_extracted(text)
                    questions.append(text)

        # Deduplicate
        questions = self._deduplicate(questions)

        return questions[:15]

    def _extract_due_date(self, transcript: str, position: int) -> Optional[str]:
        """Search for a due date near a given position in the transcript."""
        # Search in a window around the action item
        window_start = max(0, position - 100)
        window_end = min(len(transcript), position + 200)
        window = transcript[window_start:window_end]

        for pattern in self.DUE_DATE_PATTERNS:
            match = pattern.search(window)
            if match:
                return match.group(1).strip()

        return None

    def _looks_like_name(self, text: str) -> bool:
        """Check if text looks like a person's name."""
        if not text or len(text) < 2 or len(text) > 30:
            return False

        # Must be alphabetic (possibly with hyphens)
        if not re.match(r"^[A-Za-z\-']{2,}$", text):
            return False

        # Check against common names
        first = text.split()[0].lower()
        return first in self.COMMON_FIRST_NAMES

    @staticmethod
    def _is_meaningful(text: str, min_length: int = 5) -> bool:
        """Check if extracted text is meaningful (not just noise)."""
        if len(text) < min_length:
            return False
        # Avoid generic phrases
        noise = {
            "yes", "no", "ok", "okay", "sure", "thanks",
            "thank you", "right", "yeah", "um", "uh",
            "hm", "hmm", "mm-hmm", "alright",
        }
        if text.lower().strip(" .!?,") in noise:
            return False
        return True

    @staticmethod
    def _clean_extracted(text: str) -> str:
        """Clean up extracted text."""
        text = text.strip()
        text = re.sub(r"\s+", " ", text)
        # Capitalize first letter
        if text and text[0].islower():
            text = text[0].upper() + text[1:]
        # Ensure it ends with proper punctuation
        if text and not text[-1] in ".!?":
            text += "."
        return text

    @staticmethod
    def _deduplicate(strings: List[str]) -> List[str]:
        """Remove near-duplicate strings."""
        seen: set = set()
        result: List[str] = []
        for s in strings:
            key = s.lower()[:80]
            # Also check as substring of existing
            is_dup = False
            for existing_key in seen:
                if key in existing_key or existing_key in key:
                    is_dup = True
                    break
            if not is_dup:
                seen.add(key)
                result.append(s)
        return result


meeting_processor = MeetingProcessor()
