from typing import List, Optional
from pydantic import BaseModel, Field


class GitFileChangeStatus(BaseModel):
    path: str
    status: str  # "M", "A", "D", "R", "??"
    staged: bool = False
    additions: int = 0
    deletions: int = 0


class GitStatusResponse(BaseModel):
    branch: str
    repo_name: Optional[str] = None
    repo_path: Optional[str] = None
    upstream: Optional[str] = None
    ahead: int = 0
    behind: int = 0
    is_clean: bool = True
    staged_files: List[GitFileChangeStatus] = Field(default_factory=list)
    unstaged_files: List[GitFileChangeStatus] = Field(default_factory=list)
    untracked_files: List[str] = Field(default_factory=list)
    stashes_count: int = 0


class GitBranchItem(BaseModel):
    name: str
    is_current: bool = False
    is_remote: bool = False
    upstream: Optional[str] = None
    last_commit_sha: Optional[str] = None
    last_commit_message: Optional[str] = None
    last_commit_author: Optional[str] = None
    last_commit_date: Optional[str] = None


class GitBranchesResponse(BaseModel):
    current_branch: str
    branches: List[GitBranchItem] = Field(default_factory=list)


class CreateBranchRequest(BaseModel):
    branch_name: str
    checkout: bool = True
    start_point: Optional[str] = None


class CheckoutBranchRequest(BaseModel):
    branch_name: str
    create_if_missing: bool = False


class StageFilesRequest(BaseModel):
    paths: List[str] = Field(default_factory=list)
    stage_all: bool = False


class UnstageFilesRequest(BaseModel):
    paths: List[str] = Field(default_factory=list)
    unstage_all: bool = False


class DiscardFilesRequest(BaseModel):
    paths: List[str] = Field(default_factory=list)
    discard_all: bool = False


class CreateCommitRequest(BaseModel):
    message: str
    author_name: Optional[str] = None
    author_email: Optional[str] = None
    amend: bool = False


class CommitResult(BaseModel):
    sha: str
    short_sha: str
    branch: str
    message: str
    author: str
    timestamp: str
    files_committed: int


class GitCommitLogItem(BaseModel):
    sha: str
    short_sha: str
    author: str
    email: str
    date: str
    message: str
    parent_shas: List[str] = Field(default_factory=list)
    graph_symbol: str = "*"


class GitCommitLogResponse(BaseModel):
    commits: List[GitCommitLogItem] = Field(default_factory=list)
    total_commits: int = 0
    current_branch: str = ""


class GitDiffResponse(BaseModel):
    diff: str
    files_changed: int = 0
    additions: int = 0
    deletions: int = 0
    target_file: Optional[str] = None
    staged: bool = False


class GitStashItem(BaseModel):
    index: int
    selector: str
    sha: str
    message: str
    date: str


class GitStashListResponse(BaseModel):
    stashes: List[GitStashItem] = Field(default_factory=list)
    total: int = 0


class CreateStashRequest(BaseModel):
    message: Optional[str] = None
    include_untracked: bool = True


class ConflictFileItem(BaseModel):
    path: str
    conflict_markers_count: int


class ConflictCheckResponse(BaseModel):
    has_conflicts: bool = False
    conflicted_files: List[ConflictFileItem] = Field(default_factory=list)


class GitRemoteItem(BaseModel):
    name: str
    url: str
    is_official: bool = False
    is_private: bool = False


class GitRemotesResponse(BaseModel):
    remotes: List[GitRemoteItem] = Field(default_factory=list)
    official_configured: bool = False
    official_url: Optional[str] = None


class ConfigureRemoteRequest(BaseModel):
    name: str
    url: str


class PreflightCheckItem(BaseModel):
    check: str
    status: str
    details: str


class ReleaseSyncRequest(BaseModel):
    target_remote: str = "official"
    remote_url: Optional[str] = None
    source_branch: str = "main"
    target_branch: str = "main"
    tag: Optional[str] = None
    dry_run: bool = True
    skip_tests: bool = True


class ReleaseSyncResponse(BaseModel):
    success: bool
    target_remote: str
    remote_url: str
    source_branch: str
    target_branch: str
    release_tag: Optional[str] = None
    commit_sha: str
    short_sha: str
    dry_run: bool
    message: str
    preflight_checks: List[PreflightCheckItem] = Field(default_factory=list)


class DiscoveredWorkspaceItem(BaseModel):
    name: str
    path: str
    is_git_repo: bool = False
    branch: Optional[str] = None
    is_active: bool = False


class WorkspaceListResponse(BaseModel):
    active_repo_name: str
    active_repo_path: str
    active_branch: str = "main"
    discovered_workspaces: List[DiscoveredWorkspaceItem] = Field(default_factory=list)


class ConnectWorkspaceRequest(BaseModel):
    path: Optional[str] = None
    git_url: Optional[str] = None
    branch: Optional[str] = None
    init_git_if_missing: bool = False



