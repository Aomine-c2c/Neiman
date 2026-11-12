"""
Web Harvester & Open Data Gathering API Router for NEIMAN OS.

Exposes REST endpoints allowing agents and human operators to query public platforms
(GitHub, Reddit, Hacker News, Wikipedia, DuckDuckGo, Web Reader) without paid API keys.
"""

from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from nexora.core.harvester import FreeWebHarvester, HarvestResponse
from nexora.core.permissions import require_member
from nexora.database import get_db
from nexora.domains.auth.models import User
from nexora.domains.auth.router import get_current_user

router = APIRouter(
    prefix="/companies/{company_id}/harvester", tags=["Web Harvester & Public Intelligence"]
)


class HarvestRequest(BaseModel):
    platform: Literal["github", "reddit", "hackernews", "wikipedia", "duckduckgo", "web_page"]
    query_or_target: str = Field(
        ..., min_length=1, description="Search term, subreddit, repo, or URL"
    )
    mode: str | None = Field(
        default=None,
        description="Sub-mode e.g. search_repos/readme (GitHub), hot/top (Reddit), top/ask/show (HN)",
    )
    limit: int = Field(default=5, ge=1, le=25)


@router.post("/gather", response_model=HarvestResponse)
async def gather_platform_data(
    company_id: uuid.UUID,
    payload: HarvestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_member()),
):
    """
    Gathers structured intelligence from popular public platforms without paid APIs.
    """
    harvester = FreeWebHarvester()

    if payload.platform == "github":
        mode_val = payload.mode or "search_repos"
        return await harvester.harvest_github(
            target=payload.query_or_target,
            mode="readme" if mode_val == "readme" else "search_repos",
            limit=payload.limit,
        )
    elif payload.platform == "reddit":
        sort_val = payload.mode or "hot"
        return await harvester.harvest_reddit(
            subreddit=payload.query_or_target,
            limit=payload.limit,
            sort="top" if sort_val == "top" else ("new" if sort_val == "new" else "hot"),
        )
    elif payload.platform == "hackernews":
        mode_val = payload.mode or "top"
        hn_mode: Literal["top", "new", "ask", "show"] = (
            "ask"
            if mode_val == "ask"
            else ("show" if mode_val == "show" else ("new" if mode_val == "new" else "top"))
        )
        return await harvester.harvest_hacker_news(
            mode=hn_mode,
            limit=payload.limit,
        )
    elif payload.platform == "wikipedia":
        return await harvester.harvest_wikipedia(query=payload.query_or_target)
    elif payload.platform == "duckduckgo":
        return await harvester.harvest_duckduckgo(
            query=payload.query_or_target, limit=payload.limit
        )
    elif payload.platform == "web_page":
        return await harvester.scrape_web_page(target_url=payload.query_or_target)

    # Fallback to duckduckgo
    return await harvester.harvest_duckduckgo(query=payload.query_or_target, limit=payload.limit)


@router.get("/quick-search", response_model=HarvestResponse)
async def quick_web_search(
    company_id: uuid.UUID,
    q: str = Query(..., min_length=1, description="Web query"),
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_member()),
):
    """
    Quick zero-paid-API web search query for agents.
    """
    harvester = FreeWebHarvester()
    return await harvester.harvest_duckduckgo(query=q, limit=limit)
