"""
FIFA Nexus AI — Wayfinding Security & Input Sanitization
Validates and sanitizes input to prevent HTML injection and log injection.
"""

from __future__ import annotations

import bleach


def sanitize_string(text: str) -> str:
    """Sanitize input string by stripping all HTML tags."""
    if not text:
        return ""
    # Strip HTML tags
    clean_text = bleach.clean(text, tags=[], attributes={}, strip=True)
    # Prevent CRLF log injection by removing newlines
    clean_text = clean_text.replace("\n", " ").replace("\r", " ")
    return clean_text.strip()
