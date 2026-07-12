"""Plain text parser."""
from __future__ import annotations

from typing import List, Tuple


class TextParser:
    """Parse plain-text documents into pages (simulated)."""

    def parse(self, content_bytes: bytes) -> List[Tuple[int, str]]:
        """Parse raw bytes as UTF-8 text, splitting into simulated pages."""
        text = content_bytes.decode("utf-8", errors="replace")
        lines = text.splitlines()
        pages: List[Tuple[int, str]] = []
        current_lines: List[str] = []
        current_len = 0
        page_num = 1

        for line in lines:
            if current_len + len(line) > 3000 and current_lines:
                pages.append((page_num, "\n".join(current_lines)))
                page_num += 1
                current_lines = []
                current_len = 0
            current_lines.append(line)
            current_len += len(line)

        if current_lines:
            pages.append((page_num, "\n".join(current_lines)))

        return pages


text_parser = TextParser()
