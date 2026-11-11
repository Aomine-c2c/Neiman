"""
Local AI Proxy Engine for NEIMAN OS.

Provides an OpenAI-compatible reverse proxy endpoint (/v1/chat/completions) that:
1. Intercepts standard OpenAI chat completion payloads.
2. Applies built-in algorithmic token compression (stripping preambles, hedging, pleasantries, excess tokens).
3. Intelligently routes across available providers (OpenAI, Anthropic, Google Gemini, Local/On-Premise)
   using multi-tiered automatic fallback (PRIMARY -> FALLBACK -> SECONDARY FALLBACK -> LOCAL DEGRADED).
4. Tracks token savings, latency, circuit-breaker telemetry, and exact routing choices.
"""

from __future__ import annotations

import time
import uuid
from typing import Literal

from pydantic import BaseModel, Field

from nexora.core.compression import TokenCompressor
from nexora.domains.intelligence.router_service import IntelligenceRouter
from nexora.domains.intelligence.schemas import ModelRequest, ModelResponsePayload


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "function", "tool"] = "user"
    content: str
    name: str | None = None


class ChatCompletionRequest(BaseModel):
    messages: list[ChatMessage]
    model: str = "gpt-4o"
    temperature: float | None = 0.7
    max_tokens: int | None = None
    stream: bool = False
    # Intelligent Proxy Extensions
    enable_token_compression: bool = True
    compression_strategy: str = "BALANCED"
    allow_fallback: bool = True
    required_capabilities: list[str] = Field(default_factory=lambda: ["reasoning"])
    company_id: uuid.UUID | None = None


class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: str = "stop"


class ChatCompletionUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    compressed_tokens_saved: int = 0
    compression_ratio_pct: float = 0.0


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[ChatCompletionChoice]
    usage: ChatCompletionUsage
    # Proxy observability metadata
    routed_provider: str
    routed_tier: str
    routed_via_fallback: bool
    fallback_attempts: int
    latency_ms: float
    estimated_cost_usd: float


class LocalAIProxy:
    """
    Standard-compliant local AI proxy routing completions across vendor ecosystems.
    """

    @classmethod
    def assemble_prompt(
        cls,
        messages: list[ChatMessage],
        enable_compression: bool = True,
        strategy: str = "BALANCED",
    ) -> tuple[str, str, int, int]:
        """
        Combines messages into system prompt and user conversation prompt,
        applying algorithmic token compression to minimize downstream inference tokens.
        Returns: (system_prompt, user_prompt, tokens_saved, orig_tokens)
        """
        sys_parts: list[str] = []
        user_parts: list[str] = []

        for msg in messages:
            if msg.role == "system":
                sys_parts.append(msg.content)
            else:
                user_parts.append(f"{msg.role.upper()}: {msg.content}")

        raw_sys = "\n".join(sys_parts)
        raw_user = "\n".join(user_parts)

        orig_sys_tokens = TokenCompressor.estimate_tokens(raw_sys)
        orig_user_tokens = TokenCompressor.estimate_tokens(raw_user)
        total_orig_tokens = orig_sys_tokens + orig_user_tokens

        if not enable_compression:
            return raw_sys, raw_user, 0, total_orig_tokens

        comp_sys = TokenCompressor.compress(raw_sys, strategy=strategy)
        comp_user = TokenCompressor.compress(raw_user, strategy=strategy)

        saved = comp_sys.tokens_saved + comp_user.tokens_saved
        return comp_sys.compressed_text, comp_user.compressed_text, saved, total_orig_tokens

    @classmethod
    async def process_completion(
        cls,
        router: IntelligenceRouter,
        company_id: uuid.UUID,
        request: ChatCompletionRequest,
    ) -> ChatCompletionResponse:
        """
        Transforms OpenAI chat completion payload into an Intelligence Exchange ModelRequest,
        dispatches through the multi-tiered fallback pipeline, and packages the result into
        an OpenAI-compatible response with detailed routing and compression telemetry.
        """
        start_time = time.perf_counter()

        system_prompt, prompt_text, tokens_saved, orig_tokens = cls.assemble_prompt(
            messages=request.messages,
            enable_compression=request.enable_token_compression,
            strategy=request.compression_strategy,
        )

        model_request = ModelRequest(
            prompt=prompt_text,
            system_prompt=system_prompt or None,
            preferred_model=request.model,
            required_capabilities=request.required_capabilities,
            allow_fallback=request.allow_fallback,
            temperature=request.temperature or 0.7,
            max_tokens=request.max_tokens or 2048,
            enable_token_compression=False,  # Already compressed in proxy layer
        )

        # Route through Intelligence Router (handles tiered fallback and circuit breakers)
        result: ModelResponsePayload = await router.route_and_execute(
            company_id=company_id,
            request=model_request,
        )

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        completion_tokens = TokenCompressor.estimate_tokens(result.text)
        prompt_tokens = TokenCompressor.estimate_tokens(prompt_text)
        compression_ratio = (
            round((tokens_saved / orig_tokens * 100.0), 2) if orig_tokens > 0 else 0.0
        )

        return ChatCompletionResponse(
            id=f"chatcmpl-proxy-{uuid.uuid4().hex[:12]}",
            created=int(time.time()),
            model=result.model_used,
            choices=[
                ChatCompletionChoice(
                    index=0,
                    message=ChatMessage(
                        role="assistant",
                        content=result.text,
                    ),
                    finish_reason="stop",
                )
            ],
            usage=ChatCompletionUsage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                compressed_tokens_saved=tokens_saved,
                compression_ratio_pct=compression_ratio,
            ),
            routed_provider=result.provider_used,
            routed_tier=result.routed_tier,
            routed_via_fallback=result.routed_via_fallback,
            fallback_attempts=result.attempts_count,
            latency_ms=latency_ms,
            estimated_cost_usd=round(result.estimated_cost_usd, 6),
        )
