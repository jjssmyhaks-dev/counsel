"""PDF text extraction with structure detection."""
from __future__ import annotations

import re
from io import BytesIO
from typing import List, Tuple

from pypdf import PdfReader


class PdfParser:
    """Extracts structured text content from PDF files, preserving page
    numbers and detecting section headings."""

    def parse(self, content: bytes) -> List[Tuple[int, str]]:
        """Parse a PDF from raw bytes and return a list of (page_num, text) tuples."""
        reader = PdfReader(BytesIO(content))
        pages: List[Tuple[int, str]] = []

        for page_idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text()
            if text:
                cleaned = self._clean_text(text)
                pages.append((page_idx, cleaned))

        return pages

    @staticmethod
    def _clean_text(text: str) -> str:
        """Normalise whitespace and strip stray control characters."""
        # Collapse multiple newlines into double newlines (paragraph breaks)
        text = re.sub(r"\n{3,}", "\n\n", text)
        # Remove form-feeds and other stray control chars
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
        # Normalise whitespace on each line
        lines = [" ".join(line.split()) for line in text.splitlines()]
        return "\n".join(lines)

    @staticmethod
    def detect_headings(text: str) -> List[Tuple[str, int]]:
        """Detect probable section headings in text.

        Returns a list of (heading_text, line_index) tuples where line_index
        is relative to the start of the provided text.
        """
        headings: List[Tuple[str, int]] = []
        lines = text.splitlines()

        heading_patterns = [
            # Numbered sections: "1.", "1.1", "Article 1", "Section 1", "§ 1"
            re.compile(
                r"^\s*((?:Article|Section|Clause|SECTION|ARTICLE|CLAUSE)\s+(?:[IVXLCDM]+|\d+))[\s.:]",
                re.IGNORECASE,
            ),
            # Roman numeral sections: "IV.", "III -"
            re.compile(
                r"^\s*((?:[IVXLCDM]{1,8})[\.\)\s-])",
            ),
            # Numbered: "1.", "1.1 Title", "1.1.1"
            re.compile(r"^\s*(\d+(?:\.\d+)*)\s+[A-Z]"),
            # All-caps short lines (likely headings)
            re.compile(r"^[A-Z][A-Z\s]{4,60}$"),
            # Defined-term headings: "DEFINITIONS", "BACKGROUND"
            re.compile(r"^[A-Z][A-Z\s/&-]{10,80}$"),
        ]

        for line_idx, line in enumerate(lines):
            stripped = line.strip()
            if not stripped or len(stripped) < 4:
                continue
            for pat in heading_patterns:
                if pat.match(stripped):
                    headings.append((stripped, line_idx))
                    break

        return headings


pdf_parser = PdfParser()
