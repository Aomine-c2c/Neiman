#!/usr/bin/env python3
"""
Zero-Filler Scrubbing & Fragment Transformation Utility for NEIMAN OS.
Strips polite preamble, hedging transitions, and postamble meta-filler.
Transforms loose paragraphs into high-density technical fragments.
"""

import re
import sys


PREAMBLE_PATTERNS = [
    r"^(?:(?:Certainly|Sure|Sure thing|Of course|Alright|Okay|Great|Got it|Understood|No problem)[!.,\s]*)+",
    r"^(?:Here (?:is|are)(?: the)?|Below (?:is|are)(?: the)?|Please find(?: the)?)[^:\n]*:?\s*",
    r"^(?:I(?:'d| would)? (?:be happy|like) to (?:help|assist|provide)[^:\n]*:?\s*)",
    r"^(?:As an AI (?:language model|assistant)[^,\n]*,?\s*)",
    r"^(?:Based on your request|According to your request|As requested)[^,\n]*,?\s*",
    r"^(?:In response to your query|Regarding your question)[^,\n]*,?\s*",
]

HEDGING_PATTERNS = [
    r"(?i)\b(?:please note that|it is important to (?:note|remember) that|keep in mind that)\b\s*",
    r"(?i)\b(?:feel free to (?:let me know|ask|reach out)|don't hesitate to reach out)\b[.!?,]?",
    r"(?i)\b(?:hope this helps|let me know if you need anything else|let me know if you have any questions)\b[.!?,]?",
    r"(?i)\b(?:as (?:mentioned|stated|discussed) earlier|as you (?:may )?know)\b,?\s*",
]

POSTAMBLE_PATTERNS = [
    r"(?i)(?:\n\s*)?(?:In summary|To summarize|In conclusion|Overall)[^:\n]*:?\s*",
    r"(?i)(?:\n\s*)?(?:Summary:\s*)",
]


def scrub_and_fragment(text: str) -> str:
    if not text or not text.strip():
        return ""

    # Preserve markdown code blocks during scrubbing
    code_blocks: list[str] = []

    def _extract_code(match: re.Match) -> str:
        code_blocks.append(match.group(0))
        return f"__CODE_BLOCK_{len(code_blocks) - 1}__"

    processed = re.sub(r"```[\s\S]*?```", _extract_code, text)

    for pat in PREAMBLE_PATTERNS:
        processed = re.sub(pat, "", processed, flags=re.IGNORECASE).lstrip()

    for pat in HEDGING_PATTERNS:
        processed = re.sub(pat, "", processed, flags=re.IGNORECASE)

    for pat in POSTAMBLE_PATTERNS:
        processed = re.sub(pat, "", processed, flags=re.IGNORECASE)

    processed = re.sub(r"\n{3,}", "\n\n", processed).strip()

    # Convert prose paragraphs to bullet fragments if no structural markdown exists
    lines = processed.splitlines()
    has_structure = any(
        line.strip().startswith(("-", "*", "1.", "2.", "3.", "#", "|", "__CODE_BLOCK_"))
        for line in lines
    )

    if not has_structure:
        paragraphs = [p.strip() for p in processed.split("\n\n") if p.strip()]
        clauses = []
        for p in paragraphs:
            for s in re.split(r"(?<=[.!?])\s+", p):
                s_clean = s.strip()
                s_clean = re.sub(
                    r"^(?:Additionally|Furthermore|Moreover|In addition|Also|However|Therefore|Thus|Hence|Consequently|Basically|Essentially)[,\s]+",
                    "",
                    s_clean,
                    flags=re.IGNORECASE,
                ).strip()
                if s_clean:
                    clauses.append(s_clean)
        if len(clauses) > 1:
            processed = "\n".join(f"- {c}" for c in clauses)

    for idx, block in enumerate(code_blocks):
        processed = processed.replace(f"__CODE_BLOCK_{idx}__", block)

    return processed


if __name__ == "__main__":
    raw_input = sys.stdin.read()
    sys.stdout.write(scrub_and_fragment(raw_input))
