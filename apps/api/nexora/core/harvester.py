"""
Open Web Harvester & Free Platform Data Gathering Engine for NEIMAN OS.

Enables autonomous agents to gather structured intelligence from popular platforms
without requiring costly or restricted API keys:
1. GitHub (Public repos, READMEs, commit histories, releases via public REST & raw mirrors)
2. Reddit (Subreddit threads, top posts, search results via public JSON endpoints)
3. Hacker News (Frontpage stories, Ask/Show HN, comments via Firebase API)
4. Wikipedia (Articles, summaries, infobox concepts via Action API)
5. DuckDuckGo / Instant Answers & HTML search (Free web discovery & zero-click facts)
6. Generic Web Scraper / Reader (HTML-to-Markdown content extraction, metadata, links)

Security & Governance:
- All outbound requests are validated through ToolSandbox.validate_external_url
- Egress loopback, RFC1918 private subnets, and cloud metadata (169.254.169.254) are rejected
- User-Agent rotates realistically with descriptive bot headers
- Token compression / markdown cleanup for minimal context footprint
"""

from __future__ import annotations

import html
import re
import time
from typing import Any, Literal
from urllib.parse import quote, quote_plus, urlparse

import httpx
from pydantic import BaseModel, Field

from nexora.core.security import ToolSandbox

# =====================================================================
# SCHEMAS
# =====================================================================


class GatheredItem(BaseModel):
    id: str
    title: str
    url: str
    snippet: str
    author_or_source: str | None = None
    timestamp: str | None = None
    score_or_metric: int | float | None = None
    raw_content: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class HarvestResponse(BaseModel):
    platform: str
    query_or_target: str
    total_items: int
    duration_ms: float
    items: list[GatheredItem]
    markdown_summary: str
    cached: bool = False


# =====================================================================
# PLATFORM HARVESTER ENGINE
# =====================================================================


class FreeWebHarvester:
    """
    Zero-paid-API autonomous web intelligence scraper and reader.
    """

    DEFAULT_USER_AGENT = (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 (NEIMAN-Agent-Harvester/1.0)"
    )
    WIKIPEDIA_USER_AGENT = "NeimanAutonomousHarvester/1.0 (https://neiman.ai; security@neiman.ai)"

    def __init__(self, timeout: float = 12.0):
        self.timeout = timeout

    def _clean_html_to_markdown(self, raw_html: str) -> str:
        """Strips scripts, styles, tags, and compresses whitespace to readable markdown."""
        if not raw_html:
            return ""

        # Remove scripts, styles, svg, and head
        cleaned = re.sub(
            r"<(script|style|svg|noscript|head)[^>]*>.*?</\1>",
            " ",
            raw_html,
            flags=re.DOTALL | re.IGNORECASE,
        )
        # Convert links <a href="url">text</a> -> [text](url)
        cleaned = re.sub(
            r'<a\s+(?:[^>]*?\s+)?href=["\']([^"\']*)["\'][^>]*>(.*?)</a>',
            r"[\2](\1)",
            cleaned,
            flags=re.DOTALL | re.IGNORECASE,
        )
        # Convert headers
        cleaned = re.sub(
            r"<h[1-3][^>]*>(.*?)</h[1-3]>", r"\n### \1\n", cleaned, flags=re.IGNORECASE
        )
        # Convert list items
        cleaned = re.sub(r"<li[^>]*>(.*?)</li>", r"\n- \1", cleaned, flags=re.IGNORECASE)
        # Convert paragraphs & breaks
        cleaned = re.sub(r"<br\s*/?>", "\n", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"</p>", "\n\n", cleaned, flags=re.IGNORECASE)
        # Strip all remaining tags
        cleaned = re.sub(r"<[^>]+>", " ", cleaned)
        # Unescape HTML entities
        cleaned = html.unescape(cleaned)
        # Clean excessive spacing
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        cleaned = re.sub(r"\n\s*\n\s*\n+", "\n\n", cleaned)
        return cleaned.strip()

    # ── 1. GITHUB PUBLIC HARVESTER ──────────────────────────────────────────

    async def harvest_github(
        self,
        target: str,
        mode: Literal["search_repos", "readme", "releases"] = "search_repos",
        limit: int = 5,
    ) -> HarvestResponse:
        """
        Gathers repo data, README documentation, or releases via public GitHub endpoints.
        """
        start = time.perf_counter()
        items: list[GatheredItem] = []

        headers = {
            "User-Agent": self.DEFAULT_USER_AGENT,
            "Accept": "application/vnd.github.v3+json",
        }

        async with httpx.AsyncClient(
            headers=headers,
            timeout=self.timeout,
            follow_redirects=True,
            event_hooks={"request": [ToolSandbox.validate_httpx_request]},
        ) as client:
            if mode == "search_repos":
                url = f"https://api.github.com/search/repositories?q={quote_plus(target)}&sort=stars&order=desc&per_page={limit}"
                await ToolSandbox.validate_external_url_async(url)
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    for r in data.get("items", [])[:limit]:
                        items.append(
                            GatheredItem(
                                id=str(r.get("id")),
                                title=r.get("full_name", ""),
                                url=r.get("html_url", ""),
                                snippet=r.get("description") or "No description provided",
                                author_or_source=r.get("owner", {}).get("login"),
                                timestamp=r.get("updated_at"),
                                score_or_metric=r.get("stargazers_count", 0),
                                metadata={
                                    "language": r.get("language"),
                                    "forks": r.get("forks_count"),
                                    "license": (r.get("license") or {}).get("spdx_id"),
                                    "open_issues": r.get("open_issues_count"),
                                },
                            )
                        )
            elif mode == "readme":
                # e.g. target = "owner/repo"
                owner_repo = target.strip("/").replace("https://github.com/", "")
                url = f"https://raw.githubusercontent.com/{owner_repo}/main/README.md"
                await ToolSandbox.validate_external_url_async(url)
                resp = await client.get(url)
                if resp.status_code != 200:
                    # Fallback to master
                    url = f"https://raw.githubusercontent.com/{owner_repo}/master/README.md"
                    await ToolSandbox.validate_external_url_async(url)
                    resp = await client.get(url)

                content = resp.text if resp.status_code == 200 else "README not found"
                items.append(
                    GatheredItem(
                        id=owner_repo,
                        title=f"{owner_repo} README",
                        url=f"https://github.com/{owner_repo}",
                        snippet=content[:300] + "...",
                        author_or_source=owner_repo.split("/")[0] if "/" in owner_repo else None,
                        raw_content=content[:5000],
                    )
                )

        duration = (time.perf_counter() - start) * 1000
        summary_lines = [f"### GITHUB HARVEST: {target} ({len(items)} items)"]
        for it in items:
            metric = f" | ★ {it.score_or_metric}" if it.score_or_metric is not None else ""
            summary_lines.append(f"- **[{it.title}]({it.url})**{metric}: {it.snippet}")

        return HarvestResponse(
            platform="github",
            query_or_target=target,
            total_items=len(items),
            duration_ms=duration,
            items=items,
            markdown_summary="\n".join(summary_lines),
        )

    # ── 2. REDDIT FREE JSON HARVESTER ───────────────────────────────────────

    async def harvest_reddit(
        self, subreddit: str, limit: int = 5, sort: Literal["hot", "new", "top"] = "hot"
    ) -> HarvestResponse:
        """
        Gathers public posts and discussion threads from any subreddit using the native .json endpoint.
        """
        start = time.perf_counter()
        clean_sub = subreddit.strip("/").replace("r/", "").replace("reddit.com/", "")
        url = f"https://www.reddit.com/r/{clean_sub}/{sort}.json?limit={limit}"
        await ToolSandbox.validate_external_url_async(url)

        headers = {"User-Agent": "linux:neiman-research-agent:v1.0 (by /u/neiman_gatherer)"}
        items: list[GatheredItem] = []

        async with httpx.AsyncClient(
            headers=headers,
            timeout=self.timeout,
            follow_redirects=True,
            event_hooks={"request": [ToolSandbox.validate_httpx_request]},
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                children = data.get("data", {}).get("children", [])
                for post in children[:limit]:
                    p = post.get("data", {})
                    items.append(
                        GatheredItem(
                            id=p.get("id", ""),
                            title=p.get("title", ""),
                            url=f"https://reddit.com{p.get('permalink', '')}",
                            snippet=(p.get("selftext", "")[:350] or p.get("title", ""))
                            + ("..." if len(p.get("selftext", "")) > 350 else ""),
                            author_or_source=f"u/{p.get('author', 'anonymous')}",
                            score_or_metric=p.get("score", 0),
                            metadata={
                                "num_comments": p.get("num_comments", 0),
                                "subreddit": p.get("subreddit", clean_sub),
                                "over_18": p.get("over_18", False),
                            },
                        )
                    )

        duration = (time.perf_counter() - start) * 1000
        summary_lines = [f"### REDDIT r/{clean_sub} ({len(items)} posts)"]
        for it in items:
            summary_lines.append(
                f"- **[{it.title}]({it.url})** (↑ {it.score_or_metric} | {it.metadata.get('num_comments')} comments): {it.snippet}"
            )

        return HarvestResponse(
            platform="reddit",
            query_or_target=clean_sub,
            total_items=len(items),
            duration_ms=duration,
            items=items,
            markdown_summary="\n".join(summary_lines),
        )

    # ── 3. HACKER NEWS FREE HARVESTER ───────────────────────────────────────

    async def harvest_hacker_news(
        self, mode: Literal["top", "new", "ask", "show"] = "top", limit: int = 5
    ) -> HarvestResponse:
        """
        Gathers tech, startup, and AI intelligence from the official public Hacker News Firebase API.
        """
        start = time.perf_counter()
        base = "https://hacker-news.firebaseio.com/v0"
        url = f"{base}/{mode}stories.json"
        await ToolSandbox.validate_external_url_async(url)

        headers = {"User-Agent": self.DEFAULT_USER_AGENT}
        items: list[GatheredItem] = []

        async with httpx.AsyncClient(
            headers=headers,
            timeout=self.timeout,
            follow_redirects=True,
            event_hooks={"request": [ToolSandbox.validate_httpx_request]},
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                story_ids = resp.json()[:limit]
                for sid in story_ids:
                    item_url = f"{base}/item/{sid}.json"
                    s_resp = await client.get(item_url)
                    if s_resp.status_code == 200:
                        s_data = s_resp.json()
                        story_url = (
                            s_data.get("url") or f"https://news.ycombinator.com/item?id={sid}"
                        )
                        items.append(
                            GatheredItem(
                                id=str(sid),
                                title=s_data.get("title", ""),
                                url=story_url,
                                snippet=html.unescape(
                                    s_data.get("text", "")[:300]
                                    if s_data.get("text")
                                    else s_data.get("title", "")
                                ),
                                author_or_source=s_data.get("by"),
                                score_or_metric=s_data.get("score", 0),
                                metadata={
                                    "comments_count": s_data.get("descendants", 0),
                                    "hn_thread": f"https://news.ycombinator.com/item?id={sid}",
                                    "type": s_data.get("type", "story"),
                                },
                            )
                        )

        duration = (time.perf_counter() - start) * 1000
        summary_lines = [f"### HACKER NEWS ({mode.upper()} - {len(items)} items)"]
        for it in items:
            summary_lines.append(
                f"- **[{it.title}]({it.url})** (points: {it.score_or_metric} | comments: {it.metadata.get('comments_count')}): {it.snippet}"
            )

        return HarvestResponse(
            platform="hackernews",
            query_or_target=mode,
            total_items=len(items),
            duration_ms=duration,
            items=items,
            markdown_summary="\n".join(summary_lines),
        )

    # ── 4. WIKIPEDIA FREE SUMMARY & CONCEPT HARVESTER ───────────────────────

    async def harvest_wikipedia(self, query: str) -> HarvestResponse:
        """
        Retrieves canonical encyclopedia summaries and concepts via Wikipedia's public Action/Rest API.
        """
        start = time.perf_counter()
        normalized_title = quote(query.strip().replace(" ", "_"))
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{normalized_title}"
        await ToolSandbox.validate_external_url_async(url)

        headers = {
            "User-Agent": self.WIKIPEDIA_USER_AGENT,
            "Accept": "application/json",
        }
        items: list[GatheredItem] = []

        async with httpx.AsyncClient(
            headers=headers,
            timeout=self.timeout,
            follow_redirects=True,
            event_hooks={"request": [ToolSandbox.validate_httpx_request]},
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                page_url = (
                    data.get("content_urls", {})
                    .get("desktop", {})
                    .get("page", f"https://en.wikipedia.org/wiki/{normalized_title}")
                )
                items.append(
                    GatheredItem(
                        id=str(data.get("pageid", query)),
                        title=data.get("title", query),
                        url=page_url,
                        snippet=data.get("extract", "No extract available."),
                        author_or_source="Wikipedia",
                        raw_content=data.get("extract_html", ""),
                        metadata={
                            "description": data.get("description"),
                            "thumbnail": (data.get("thumbnail") or {}).get("source"),
                        },
                    )
                )
            else:
                # Fallback to Action API query
                action_url = f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles={normalized_title}&format=json"
                action_resp = await client.get(action_url)
                if action_resp.status_code == 200:
                    pages = action_resp.json().get("query", {}).get("pages", {})
                    for pid, pdata in pages.items():
                        if pid != "-1":
                            items.append(
                                GatheredItem(
                                    id=str(pid),
                                    title=pdata.get("title", query),
                                    url=f"https://en.wikipedia.org/wiki/{quote(pdata.get('title', query))}",
                                    snippet=pdata.get("extract", "No extract available."),
                                    author_or_source="Wikipedia",
                                    raw_content="",
                                    metadata={},
                                )
                            )

        duration = (time.perf_counter() - start) * 1000
        summary_lines = [f"### WIKIPEDIA: {query}"]
        for it in items:
            summary_lines.append(f"**[{it.title}]({it.url})**\n{it.snippet}")

        return HarvestResponse(
            platform="wikipedia",
            query_or_target=query,
            total_items=len(items),
            duration_ms=duration,
            items=items,
            markdown_summary="\n".join(summary_lines),
        )

    # ── 5. DUCKDUCKGO ZERO-API WEB DISCOVERY ───────────────────────────────

    async def harvest_duckduckgo(self, query: str, limit: int = 5) -> HarvestResponse:
        """
        Gathers instant answers and public web results via DuckDuckGo without any API key or subscription.
        """
        start = time.perf_counter()
        encoded = quote_plus(query)
        # Use DuckDuckGo HTML Lite gateway
        url = f"https://html.duckduckgo.com/html/?q={encoded}"
        await ToolSandbox.validate_external_url_async(url)

        headers = {
            "User-Agent": self.DEFAULT_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        items: list[GatheredItem] = []

        async with httpx.AsyncClient(
            headers=headers,
            timeout=self.timeout,
            follow_redirects=True,
            event_hooks={"request": [ToolSandbox.validate_httpx_request]},
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                raw_html = resp.text
                # Match result blocks: class="result__snippet", class="result__url", class="result__title"
                # Heuristic regex on duckduckgo lite output
                results = re.findall(
                    r'<a[^>]*class="result__url"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
                    r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>',
                    raw_html,
                    re.DOTALL | re.IGNORECASE,
                )

                if not results:
                    # Secondary parser for standard HTML layout
                    results = re.findall(
                        r'<a class="result__snippet"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
                        raw_html,
                        re.DOTALL | re.IGNORECASE,
                    )

                count = 0
                for match in results:
                    if count >= limit:
                        break
                    if len(match) == 3:
                        r_url, r_title, r_snippet = match
                    else:
                        r_url, r_snippet = match[0], match[1]
                        r_title = "Web Result"

                    clean_url = html.unescape(r_url).strip()
                    # Resolve DDG redirect /uddg?uddg=...
                    if "/l/?kh=" in clean_url or "duckduckgo.com/l/" in clean_url:
                        # Extract uddg param
                        uddg_match = re.search(r"uddg=([^&]+)", clean_url)
                        if uddg_match:
                            from urllib.parse import unquote

                            clean_url = unquote(uddg_match.group(1))

                    clean_title = (
                        re.sub(r"<[^>]+>", "", html.unescape(r_title)).strip() or "Web Result"
                    )
                    clean_snippet = re.sub(r"<[^>]+>", "", html.unescape(r_snippet)).strip()

                    if clean_url.startswith("http"):
                        items.append(
                            GatheredItem(
                                id=f"ddg_{count}",
                                title=clean_title,
                                url=clean_url,
                                snippet=clean_snippet,
                                author_or_source=urlparse(clean_url).netloc,
                            )
                        )
                        count += 1

        duration = (time.perf_counter() - start) * 1000
        summary_lines = [f"### WEB SEARCH RESULTS: {query} ({len(items)} items)"]
        for it in items:
            summary_lines.append(
                f"- **[{it.title}]({it.url})** ({it.author_or_source}): {it.snippet}"
            )

        return HarvestResponse(
            platform="duckduckgo",
            query_or_target=query,
            total_items=len(items),
            duration_ms=duration,
            items=items,
            markdown_summary="\n".join(summary_lines),
        )

    # ── 6. GENERIC WEB PAGE CONTENT EXTRACTOR ──────────────────────────────

    async def scrape_web_page(self, target_url: str, max_chars: int = 6000) -> HarvestResponse:
        """
        Reads any public web page, strips scripts/bloat, and returns clean structured Markdown.
        """
        start = time.perf_counter()
        await ToolSandbox.validate_external_url_async(target_url)

        headers = {"User-Agent": self.DEFAULT_USER_AGENT}
        markdown_body = ""
        page_title = "Web Page"

        async with httpx.AsyncClient(
            headers=headers,
            timeout=self.timeout,
            follow_redirects=True,
            event_hooks={"request": [ToolSandbox.validate_httpx_request]},
        ) as client:
            resp = await client.get(target_url)
            if resp.status_code == 200:
                raw_text = resp.text
                title_match = re.search(
                    r"<title[^>]*>(.*?)</title>", raw_text, re.IGNORECASE | re.DOTALL
                )
                if title_match:
                    page_title = html.unescape(title_match.group(1)).strip()

                markdown_body = self._clean_html_to_markdown(raw_text)

        duration = (time.perf_counter() - start) * 1000
        truncated = markdown_body[:max_chars]

        item = GatheredItem(
            id=target_url,
            title=page_title,
            url=target_url,
            snippet=truncated[:350] + ("..." if len(truncated) > 350 else ""),
            author_or_source=urlparse(target_url).netloc,
            raw_content=truncated,
        )

        return HarvestResponse(
            platform="web_page",
            query_or_target=target_url,
            total_items=1,
            duration_ms=duration,
            items=[item],
            markdown_summary=f"### [{page_title}]({target_url})\n\n{truncated}",
        )
