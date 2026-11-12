"""
Tests for Free Web Harvester & Public Platform Intelligence Engine.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from nexora.core.harvester import FreeWebHarvester


@pytest.mark.asyncio
class TestFreeWebHarvester:
    async def test_clean_html_to_markdown(self):
        harvester = FreeWebHarvester()
        raw_html = """
        <html>
            <head><title>Test Title</title><script>alert('bad');</script></head>
            <body>
                <h1>Main Heading</h1>
                <p>Here is an <a href="https://example.com">example link</a> with text.</p>
                <ul>
                    <li>Feature A</li>
                    <li>Feature B</li>
                </ul>
            </body>
        </html>
        """
        md = harvester._clean_html_to_markdown(raw_html)
        assert "alert('bad')" not in md
        assert "### Main Heading" in md
        assert "[example link](https://example.com)" in md
        assert "- Feature A" in md
        assert "- Feature B" in md

    async def test_wikipedia_free_harvest(self):
        harvester = FreeWebHarvester()
        res = await harvester.harvest_wikipedia("Artificial intelligence")
        assert res.platform == "wikipedia"
        assert res.total_items >= 1
        assert "intelligence" in res.markdown_summary.lower()
        assert len(res.items[0].url) > 0

    async def test_duckduckgo_free_search(self):
        harvester = FreeWebHarvester()
        res = await harvester.harvest_duckduckgo("FastAPI documentation", limit=3)
        assert res.platform == "duckduckgo"
        assert res.query_or_target == "FastAPI documentation"
        assert len(res.items) > 0
        assert any("http" in it.url for it in res.items)

    async def test_hacker_news_free_harvest(self):
        harvester = FreeWebHarvester()
        res = await harvester.harvest_hacker_news(mode="top", limit=2)
        assert res.platform == "hackernews"
        assert res.total_items == 2
        assert len(res.items[0].title) > 0

    async def test_api_harvester_router_gather_and_quick_search(
        self, client: AsyncClient, auth_headers: dict, company_via_api: dict
    ):
        company_id = company_via_api["id"]

        # 1. POST /companies/{company_id}/harvester/gather with Wikipedia
        post_res = await client.post(
            f"/api/v1/companies/{company_id}/harvester/gather",
            json={
                "platform": "wikipedia",
                "query_or_target": "Open source software",
            },
            headers=auth_headers,
        )
        assert post_res.status_code == 200
        data = post_res.json()
        assert data["platform"] == "wikipedia"
        assert len(data["items"]) >= 1

        # 2. GET /companies/{company_id}/harvester/quick-search
        search_res = await client.get(
            f"/api/v1/companies/{company_id}/harvester/quick-search?q=Python+programming&limit=2",
            headers=auth_headers,
        )
        assert search_res.status_code == 200
        s_data = search_res.json()
        assert s_data["platform"] == "duckduckgo"
        assert len(s_data["items"]) >= 1
