"""Pydantic schemas for the Integrated Bash Terminal domain."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TerminalSessionCreate(BaseModel):
    title: str | None = Field(default=None, description="Human-readable terminal tab title")
    working_dir: str | None = Field(default=None, description="Starting directory path")
    environment_variables: dict[str, str] = Field(default_factory=dict, description="Custom shell env vars")
    cols: int = Field(default=120, ge=20, le=500, description="Terminal width in columns")
    rows: int = Field(default=34, ge=5, le=200, description="Terminal height in rows")
    initial_command: str | None = Field(default=None, description="Optional command to execute on boot")


class TerminalSessionResponse(BaseModel):
    id: str
    company_id: str
    user_id: str | None = None
    title: str
    working_dir: str
    created_at: str
    is_active: bool
    pid: int | None = None
    cols: int
    rows: int


class TerminalExecRequest(BaseModel):
    command: str = Field(..., description="Bash command line to execute")
    working_dir: str | None = Field(default=None, description="Optional working directory override")
    timeout_seconds: float = Field(default=30.0, ge=0.5, le=300.0, description="Max execution duration in seconds")


class TerminalExecResponse(BaseModel):
    session_id: str
    command: str
    exit_code: int
    stdout: str
    stderr: str
    working_dir: str
    duration_ms: float


class TerminalResizeRequest(BaseModel):
    cols: int = Field(..., ge=20, le=500)
    rows: int = Field(..., ge=5, le=200)


class TerminalSignalRequest(BaseModel):
    signal: str = Field(default="SIGINT", description="SIGINT | SIGTERM | SIGKILL | SIGHUP")


class TerminalHistoryResponse(BaseModel):
    session_id: str
    history: list[str]
    backlog: str

