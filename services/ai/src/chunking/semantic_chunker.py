"""Semantic chunking for legal documents.

Strategy:
1. Detect section/clause boundaries (SECTION, ARTICLE, CLAUSE, numbered headings).
2. Split into sections first.
3. If a section exceeds max_chunk_size, subdivide on paragraph breaks.
4. Add overlap between consecutive chunks for context preservation.
5. Attach metadata: section_title, page_number, is_clause flag.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from ..config import settings


# ── Section boundary detection ─────────────────────────────────

_SECTION_PATTERNS = [
    re.compile(
        r"^\s*((?:ARTICLE|SECTION|CLAUSE|PART|CHAPTER|SCHEDULE|APPENDIX|EXHIBIT|RECITAL)"
        r"\s+(?:[IVXLCDM]+|\d+))[\s.:\-—]+",
        re.IGNORECASE,
    ),
    re.compile(
        r"^\s*((?:ARTICLE|SECTION|CLAUSE|PART|CHAPTER|SCHEDULE|APPENDIX|EXHIBIT|RECITAL)"
        r"[\s.:\-—]+[\dIVXLCDM]+)",
        re.IGNORECASE,
    ),
    re.compile(r"^\s*(\d+\.)\s+[A-Z][A-Za-z\s]{4,}"),
    re.compile(r"^\s*([IVXLCDM]{1,8})\.\s+[A-Z]"),
    re.compile(r"^\s*(\d+\.\d+)\s+[A-Z][A-Za-z\s]{4,}"),
    re.compile(r"^[A-Z][A-Z\s\-/&]{6,60}$"),
    re.compile(r"^\s*(WHEREAS|NOW THEREFORE|IN WITNESS WHEREOF)\b", re.IGNORECASE),
]


def _is_section_boundary(line: str) -> bool:
    """Return True if the line looks like a section/clause boundary."""
    stripped = line.strip()
    if not stripped or len(stripped) < 3:
        return False
    for pat in _SECTION_PATTERNS:
        if pat.match(stripped):
            return True
    return False


def _find_section_spans(text: str) -> List[Tuple[int, int, str]]:
    """Split text into (start, end, heading) spans at section boundaries.

    Returns list of (line_start_idx, line_end_idx, heading_text) tuples.
    """
    lines = text.splitlines()
    boundaries: List[Tuple[int, str]] = []  # (line_idx, heading)

    for idx, line in enumerate(lines):
        if _is_section_boundary(line):
            boundaries.append((idx, line.strip()))

    if not boundaries:
        return [(0, len(lines), "")]

    spans: List[Tuple[int, int, str]] = []
    # Everything before the first boundary
    if boundaries[0][0] > 0:
        spans.append((0, boundaries[0][0], "PREAMBLE"))

    for i, (start_line, heading) in enumerate(boundaries):
        end_line = boundaries[i + 1][0] if i + 1 < len(boundaries) else len(lines)
        spans.append((start_line, end_line, heading))

    return spans


# ── Paragraph splitting ─────────────────────────────────────────

def _split_into_paragraphs(text: str) -> List[str]:
    """Split text on double-newline paragraph boundaries."""
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


# ── Main chunker ────────────────────────────────────────────────

class SemanticChunker:
    """Clause/section-aware chunker for legal and consulting documents."""

    def __init__(
        self,
        max_chunk_size: int | None = None,
        chunk_overlap: int | None = None,
    ) -> None:
        self.max_chunk_size = max_chunk_size or settings.max_chunk_size
        self.chunk_overlap = chunk_overlap or settings.chunk_overlap

    def chunk_document(
        self,
        pages: List[Tuple[int, str]],
        headings: Optional[List[Tuple[str, int]]] = None,
        document_id: str = "",
    ) -> List[Dict[str, Any]]:
        """Chunk a multi-page document into semantic chunks.

        Args:
            pages: List of (page_number, page_text) tuples.
            headings: Optional list of (heading_text, paragraph_index) tuples.
            document_id: Document identifier for metadata.

        Returns:
            List of chunk dicts with keys: index, text, section_title,
            page_number, is_clause, metadata.
        """
        chunks: List[Dict[str, Any]] = []
        chunk_index = 0
        # Build heading offset map: line_number → heading text
        heading_map: Dict[int, str] = {}
        if headings:
            heading_map = {h[1]: h[0] for h in headings}

        for page_num, page_text in pages:
            section_spans = _find_section_spans(page_text)
            lines = page_text.splitlines()

            for span_start, span_end, section_title in section_spans:
                section_lines = lines[span_start:span_end]
                section_text = "\n".join(section_lines).strip()
                if not section_text:
                    continue

                # Determine if this is a standalone clause
                is_clause = any(
                    kw in section_title.lower() for kw in ("clause", "article", "section")
                )

                # Chunk the section text
                section_chunks = self._chunk_section(
                    section_text,
                    section_title=section_title,
                    page_number=page_num,
                    is_clause=is_clause,
                    document_id=document_id,
                )

                for ch in section_chunks:
                    ch["index"] = chunk_index
                    chunks.append(ch)
                    chunk_index += 1

                # Add overlap chunk if needed
                if len(section_chunks) > 1 and self.chunk_overlap > 0:
                    for i in range(len(section_chunks) - 1):
                        over = self._create_overlap(
                            section_chunks[i]["text"],
                            section_chunks[i + 1]["text"],
                            section_title=section_title,
                            page_number=page_num,
                            is_clause=is_clause,
                            document_id=document_id,
                        )
                        if over:
                            over["index"] = chunk_index
                            chunks.append(over)
                            chunk_index += 1

        return chunks

    def _chunk_section(
        self,
        text: str,
        section_title: str = "",
        page_number: int = 0,
        is_clause: bool = False,
        document_id: str = "",
    ) -> List[Dict[str, Any]]:
        """Chunk a single section into manageable pieces."""
        if len(text) <= self.max_chunk_size:
            return [self._make_chunk(text, section_title, page_number, is_clause, document_id)]

        # Split into paragraphs
        paragraphs = _split_into_paragraphs(text)
        chunks: List[Dict[str, Any]] = []
        current_paras: List[str] = []
        current_len = 0

        for para in paragraphs:
            if current_len + len(para) > self.max_chunk_size and current_paras:
                chunk_text = "\n\n".join(current_paras)
                chunks.append(
                    self._make_chunk(chunk_text, section_title, page_number, is_clause, document_id)
                )
                current_paras = []
                current_len = 0
            current_paras.append(para)
            current_len += len(para)

        # Don't forget the last chunk
        if current_paras:
            chunk_text = "\n\n".join(current_paras)
            chunks.append(
                self._make_chunk(chunk_text, section_title, page_number, is_clause, document_id)
            )

        return chunks

    def _create_overlap(
        self,
        prev_text: str,
        next_text: str,
        section_title: str = "",
        page_number: int = 0,
        is_clause: bool = False,
        document_id: str = "",
    ) -> Optional[Dict[str, Any]]:
        """Create an overlap chunk bridging two consecutive chunks."""
        if self.chunk_overlap <= 0:
            return None

        prev_suffix = prev_text[-self.chunk_overlap:] if len(prev_text) > self.chunk_overlap else prev_text
        next_prefix = next_text[:self.chunk_overlap] if len(next_text) > self.chunk_overlap else next_text
        overlap_text = prev_suffix + "\n[...]\n" + next_prefix

        return self._make_chunk(
            overlap_text,
            section_title=section_title + " [overlap]",
            page_number=page_number,
            is_clause=is_clause,
            document_id=document_id,
        )

    @staticmethod
    def _make_chunk(
        text: str,
        section_title: str,
        page_number: int,
        is_clause: bool,
        document_id: str,
    ) -> Dict[str, Any]:
        """Create a chunk dict with metadata."""
        return {
            "index": -1,  # filled in by caller
            "text": text.strip(),
            "section_title": section_title or None,
            "page_number": page_number if page_number > 0 else None,
            "document_id": document_id,
            "is_clause": is_clause,
            "metadata": {"source": "semantic_chunker"},
        }


semantic_chunker = SemanticChunker()
