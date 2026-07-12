"""Parser registry — dispatch to the correct parser by MIME type."""
from __future__ import annotations

from typing import Any, Dict, List, Protocol, Tuple

from .pdf_parser import pdf_parser
from .docx_parser import docx_parser
from .text_parser import text_parser


class ParserProtocol(Protocol):
    """Protocol that all parsers must satisfy."""

    def parse(self, content: bytes) -> List[Tuple[int, str]]:
        ...

    def detect_headings(self, content_or_text: Any) -> List[Tuple[str, int]]:
        ...


class ParserRegistry:
    """Map MIME types to parsers and dispatch parse requests."""

    def __init__(self) -> None:
        self._map: Dict[str, Any] = {
            "application/pdf": pdf_parser,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": docx_parser,
            "text/plain": text_parser,
        }

    def get_parser(self, mime_type: str) -> Any:
        """Return the parser instance for a MIME type, or None if unsupported."""
        return self._map.get(mime_type)

    def supports(self, mime_type: str) -> bool:
        """Check if this registry has a parser for the given MIME type."""
        return mime_type in self._map

    def parse(self, mime_type: str, content: bytes) -> List[Tuple[int, str]]:
        """Parse document content into (page_num, text) tuples."""
        parser = self.get_parser(mime_type)
        if parser is None:
            raise ValueError(f"Unsupported MIME type: {mime_type}")

        if hasattr(parser, "parse_flat"):
            return parser.parse_flat(content)
        return parser.parse(content)

    def detect_headings(self, mime_type: str, content: bytes) -> List[Tuple[str, int]]:
        """Detect headings in document content.

        For PDFs, operates on extracted text.
        For DOCX, extracts from style information.
        For plain text, does regex-based detection.
        """
        parser = self.get_parser(mime_type)
        if parser is None:
            return []

        if hasattr(parser, "extract_headings"):
            return parser.extract_headings(content)
        if hasattr(parser, "detect_headings"):
            # Flatten all pages into one text blob
            pages = self.parse(mime_type, content)
            full_text = "\n".join(text for _, text in pages)
            return parser.detect_headings(full_text)

        return []


parser_registry = ParserRegistry()
