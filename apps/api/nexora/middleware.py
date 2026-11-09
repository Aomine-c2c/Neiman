"""Request middleware: request ID injection, logging, security headers, rate limiting."""

import time
import uuid
from collections import OrderedDict, deque
from collections.abc import Awaitable, Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from nexora.config import get_settings

logger = structlog.get_logger(__name__)
_RATE_LIMIT_MAX_CLIENTS = 4096
_RATE_LIMIT_CLEANUP_INTERVAL_SECONDS = 30.0


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Injects a unique X-Request-ID header into every request and response."""

    async def dispatch(self, request: Request, call_next):
        supplied_request_id = request.headers.get("X-Request-ID", "")
        try:
            if len(supplied_request_id) != 36:
                raise ValueError("Invalid request ID length")
            request_id = str(uuid.UUID(supplied_request_id))
        except ValueError:
            request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        start_time = time.perf_counter()
        response: Response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000

        response.headers["X-Request-ID"] = request_id

        logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
            request_id=request_id,
        )

        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects security-related HTTP response headers on every response."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        settings = get_settings()
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )

        response.headers["Content-Security-Policy"] = "default-src 'self'"

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory sliding-window rate limiter for sensitive endpoints."""

    def __init__(self, app, path_prefixes: list[str] | None = None):
        super().__init__(app)
        self._path_prefixes = path_prefixes or ["/api/v1/auth/"]
        self._request_counts: OrderedDict[str, deque[float]] = OrderedDict()
        self._last_cleanup = time.monotonic()

    def _is_rate_limited(self, client_ip: str, req_limit: int, window: int) -> bool:
        now = time.monotonic()
        cutoff = now - window
        if now - self._last_cleanup >= _RATE_LIMIT_CLEANUP_INTERVAL_SECONDS:
            for ip, timestamps in list(self._request_counts.items()):
                while timestamps and timestamps[0] <= cutoff:
                    timestamps.popleft()
                if not timestamps:
                    self._request_counts.pop(ip, None)
            self._last_cleanup = now

        timestamps = self._request_counts.get(client_ip)
        if timestamps is None:
            if len(self._request_counts) >= _RATE_LIMIT_MAX_CLIENTS:
                self._request_counts.popitem(last=False)
            timestamps = deque()
            self._request_counts[client_ip] = timestamps
        else:
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()
            self._request_counts.move_to_end(client_ip)

        if len(timestamps) >= req_limit:
            return True
        timestamps.append(now)
        return False

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]):
        settings = get_settings()
        if settings.DEBUG or settings.ENVIRONMENT == "test":
            return await call_next(request)

        if not any(request.url.path.startswith(prefix) for prefix in self._path_prefixes):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        if self._is_rate_limited(
            client_ip, settings.RATE_LIMIT_REQUESTS, settings.RATE_LIMIT_WINDOW
        ):
            response: Response = Response(
                status_code=429,
                headers={"Retry-After": str(settings.RATE_LIMIT_WINDOW)},
                media_type="application/json",
                content='{"detail": "Rate limit exceeded. Please try again later."}',
            )
            return response

        return await call_next(request)
