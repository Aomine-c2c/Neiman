"""
Comprehensive Test Suite for NEIMAN OS Input Token Compression Engine
Verifies Rule 6: Zero-Filler, High-Density Communication & Token Compression.
Tests:
- Code block byte-for-byte invariance
- Inline code preservation
- Structural JSON minification and null-stripping
- Conversational filler & hedging elimination
- Batch compression
- API endpoints: /compress, /compress/batch, /compress/stats
"""

from __future__ import annotations

import json
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from nexora.core.compression import (
    CompressionBreakdown,
    CompressionResult,
    CompressionStrategy,
    TokenCompressor,
)
from nexora.main import app


def test_code_block_preservation():
    """Guarantees code blocks (```...```) are protected and restored byte-for-byte."""
    code_snippet = """```python
def fibonacci(n: int) -> int:
    # Essential algorithm comment
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
```"""
    input_text = f"Sure! I'd be very happy to provide the fibonacci code below:\n{code_snippet}\nLet me know if you have any questions!"

    result = TokenCompressor.compress(input_text, strategy=CompressionStrategy.AGGRESSIVE)

    assert code_snippet in result.compressed_text
    assert "Sure!" not in result.compressed_text
    assert "Let me know if you have any questions" not in result.compressed_text
    assert result.tokens_saved > 0
    assert result.compressed_tokens < result.original_tokens


def test_inline_code_preservation():
    """Guarantees inline markdown code spans (`...`) are never corrupted or stripped."""
    input_text = "Please ensure that `user_id` and `auth_token` are passed in order to authenticate."
    result = TokenCompressor.compress(input_text, strategy=CompressionStrategy.BALANCED)

    assert "`user_id`" in result.compressed_text
    assert "`auth_token`" in result.compressed_text
    assert "in order to" not in result.compressed_text
    assert "to" in result.compressed_text


def test_json_compaction_and_null_stripping():
    """Verifies embedded JSON data is minified and empty/null fields stripped."""
    raw_json = json.dumps(
        {
            "service": "billing",
            "active": True,
            "deprecated_field": None,
            "quota": 50000,
            "redundant_null": None,
        },
        indent=4,
    )
    fenced_prompt = f"Here is the service config:\n```json\n{raw_json}\n```\nPlease make sure to deploy this."

    result = TokenCompressor.compress(fenced_prompt, strategy=CompressionStrategy.DYNAMIC)

    assert "```json" in result.compressed_text
    assert '"deprecated_field":null' not in result.compressed_text
    assert '"redundant_null":null' not in result.compressed_text
    assert '"service":"billing"' in result.compressed_text or '"service": "billing"' in result.compressed_text
    assert result.breakdown.json_tokens_saved > 0


def test_discourse_and_wordy_phrase_replacement():
    """Verifies wordy bureaucratic idioms are replaced with dense equivalents."""
    text = (
        "In order to proceed at this point in time, due to the fact that we need verification, "
        "we must take into consideration the audit logs."
    )
    result = TokenCompressor.compress(text, strategy=CompressionStrategy.BALANCED)

    assert "in order to" not in result.compressed_text.lower()
    assert "at this point in time" not in result.compressed_text.lower()
    assert "due to the fact that" not in result.compressed_text.lower()
    assert "take into consideration" not in result.compressed_text.lower()
    assert "because" in result.compressed_text.lower()
    assert "consider" in result.compressed_text.lower()


def test_batch_compression():
    """Verifies batch compression across multiple prompts."""
    prompts = [
        "Certainly! Please find the database credentials in the vault.",
        "Could you please make sure that the backup runs every hour?",
        "```sql\nSELECT * FROM users WHERE active = true;\n```",
    ]
    results = TokenCompressor.compress_batch(prompts, strategy=CompressionStrategy.DYNAMIC)

    assert len(results) == 3
    assert all(isinstance(r, CompressionResult) for r in results)
    assert results[0].tokens_saved > 0
    assert "Certainly!" not in results[0].compressed_text


@pytest.mark.asyncio
async def test_api_compression_endpoints(
    client: AsyncClient, auth_headers: dict, company_via_api: dict
):
    """Tests POST /compress, POST /compress/batch, and GET /compress/stats."""
    company_id = company_via_api["id"]

    # 1. Single compression
    resp = await client.post(
        f"/api/v1/companies/{company_id}/intelligence/compress",
        headers=auth_headers,
        json={
            "text": "Certainly! I would be very happy to assist you today. In order to run tests, use pytest.",
            "strategy": "DYNAMIC",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "compressed_text" in data
    assert data["original_tokens"] > data["compressed_tokens"]
    assert data["tokens_saved"] > 0
    assert data["compression_ratio_pct"] > 0
    assert "breakdown" in data
    assert "Certainly!" not in data["compressed_text"]

    # 2. Batch compression
    batch_resp = await client.post(
        f"/api/v1/companies/{company_id}/intelligence/compress/batch",
        headers=auth_headers,
        json={
            "texts": [
                "Hello! Please note that the server will restart at midnight.",
                "```bash\necho 'hello world'\n```",
            ],
            "strategy": "AGGRESSIVE",
        },
    )
    assert batch_resp.status_code == 200
    bdata = batch_resp.json()
    assert len(bdata["results"]) == 2
    assert bdata["total_original_tokens"] >= bdata["total_compressed_tokens"]

    # 3. Compression stats
    stats_resp = await client.get(
        f"/api/v1/companies/{company_id}/intelligence/compress/stats",
        headers=auth_headers,
    )
    assert stats_resp.status_code == 200
    sdata = stats_resp.json()
    assert sdata["total_requests_compressed"] > 0
    assert sdata["average_compression_ratio_pct"] > 0
    assert "DYNAMIC" in sdata["active_strategies"]
