"""Domain exceptions and FastAPI exception handlers."""

import traceback

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

# ── Domain Exceptions ──────────────────────────────────────────────────────


class NexoraError(Exception):
    """Base exception for all NEIMAN domain errors."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    detail: str = "An unexpected error occurred."

    def __init__(self, detail: str | None = None):
        self.detail = detail or self.__class__.detail
        super().__init__(self.detail)


class NotFoundError(NexoraError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Resource not found."


class ConflictError(NexoraError):
    status_code = status.HTTP_409_CONFLICT
    detail = "Resource already exists."


class ForbiddenError(NexoraError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "You do not have permission to perform this action."


class PermissionDeniedError(ForbiddenError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "Permission denied by governance policy."


class UnauthorizedError(NexoraError):
    status_code = status.HTTP_401_UNAUTHORIZED
    detail = "Authentication required."


class ValidationError(NexoraError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    detail = "Validation failed."


class BusinessRuleError(NexoraError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Business rule violation."


# ── FastAPI Exception Handlers ─────────────────────────────────────────────


async def NEIMAN_exception_handler(request: Request, exc: NexoraError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "message": exc.detail,
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    from nexora.core.security import PromptSanitizer

    safe_trace = PromptSanitizer.scrub_secrets(traceback.format_exc())
    request_id = getattr(request.state, "request_id", None)
    import structlog

    structlog.get_logger(__name__).error(
        "unhandled_api_exception",
        method=request.method,
        path=request.url.path,
        request_id=request_id,
        trace=safe_trace,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": "An internal error occurred.",
            "request_id": request_id,
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(NexoraError, NEIMAN_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_exception_handler)  # type: ignore[arg-type]
