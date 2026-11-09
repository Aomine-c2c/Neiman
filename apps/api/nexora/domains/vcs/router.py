from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from nexora.domains.auth.router import get_current_user
from nexora.domains.auth.models import User
from nexora.domains.vcs.models import (
    CheckoutBranchRequest,
    CommitResult,
    ConfigureRemoteRequest,
    ConflictCheckResponse,
    CreateBranchRequest,
    CreateCommitRequest,
    CreateStashRequest,
    DiscardFilesRequest,
    GitBranchesResponse,
    GitCommitLogResponse,
    GitDiffResponse,
    GitRemotesResponse,
    GitStashListResponse,
    GitStatusResponse,
    ReleaseSyncRequest,
    ReleaseSyncResponse,
    StageFilesRequest,
    UnstageFilesRequest,
)
from nexora.domains.vcs.service import GitService

router = APIRouter(
    prefix="/companies/{company_id}/vcs",
    tags=["VCS & Code Management"],
)


def get_git_service() -> GitService:
    return GitService()


@router.get("/status", response_model=GitStatusResponse, summary="Get working tree status and branch tracking")
async def get_status(
    company_id: UUID,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.get_status()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query git status: {exc}",
        )


@router.get("/branches", response_model=GitBranchesResponse, summary="List local and remote branches")
async def get_branches(
    company_id: UUID,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.get_branches()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list branches: {exc}",
        )


@router.post("/branches", response_model=GitBranchesResponse, summary="Create a new git branch")
async def create_branch(
    company_id: UUID,
    payload: CreateBranchRequest,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.create_branch(
            branch_name=payload.branch_name,
            checkout=payload.checkout,
            start_point=payload.start_point,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create branch: {exc}",
        )


@router.post("/checkout", response_model=GitBranchesResponse, summary="Checkout or switch git branch")
async def checkout_branch(
    company_id: UUID,
    payload: CheckoutBranchRequest,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.checkout_branch(
            branch_name=payload.branch_name,
            create_if_missing=payload.create_if_missing,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to switch branch: {exc}",
        )


@router.post("/stage", response_model=GitStatusResponse, summary="Stage file(s) or all working tree changes")
async def stage_files(
    company_id: UUID,
    payload: StageFilesRequest,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.stage_files(paths=payload.paths, stage_all=payload.stage_all)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stage files: {exc}",
        )


@router.post("/unstage", response_model=GitStatusResponse, summary="Unstage file(s) or all staged changes")
async def unstage_files(
    company_id: UUID,
    payload: UnstageFilesRequest,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.unstage_files(paths=payload.paths, unstage_all=payload.unstage_all)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unstage files: {exc}",
        )


@router.post("/discard", response_model=GitStatusResponse, summary="Discard working tree modifications")
async def discard_changes(
    company_id: UUID,
    payload: DiscardFilesRequest,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.discard_changes(paths=payload.paths, discard_all=payload.discard_all)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to discard changes: {exc}",
        )


@router.post("/commit", response_model=CommitResult, summary="Create a git commit with staged changes")
async def create_commit(
    company_id: UUID,
    payload: CreateCommitRequest,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        author_name = payload.author_name or getattr(current_user, "name", "NEIMAN Operator")
        author_email = payload.author_email or getattr(current_user, "email", "operator@neiman.ai")
        return await service.create_commit(
            message=payload.message,
            author_name=author_name,
            author_email=author_email,
            amend=payload.amend,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create commit: {exc}",
        )


@router.get("/log", response_model=GitCommitLogResponse, summary="Get visual commit history DAG graph")
async def get_commit_log(
    company_id: UUID,
    max_count: int = Query(50, ge=1, le=100),
    branch: Optional[str] = Query(None),
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.get_commit_log(max_count=max_count, branch=branch)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch commit log: {exc}",
        )


@router.get("/diff", response_model=GitDiffResponse, summary="Get working tree or commit unified diff")
async def get_diff(
    company_id: UUID,
    file_path: Optional[str] = Query(None),
    staged: bool = Query(False),
    commit_sha: Optional[str] = Query(None),
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.get_diff(file_path=file_path, staged=staged, commit_sha=commit_sha)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate diff: {exc}",
        )


@router.get("/stashes", response_model=GitStashListResponse, summary="List git stashes")
async def get_stashes(
    company_id: UUID,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.get_stashes()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list stashes: {exc}",
        )


@router.post("/stashes", response_model=GitStashListResponse, summary="Create a new git stash")
async def create_stash(
    company_id: UUID,
    payload: CreateStashRequest,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.create_stash(
            message=payload.message,
            include_untracked=payload.include_untracked,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create stash: {exc}",
        )


@router.post("/stashes/{index}/apply", response_model=GitStatusResponse, summary="Apply git stash without dropping")
async def apply_stash(
    company_id: UUID,
    index: int,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.apply_stash(index=index)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply stash: {exc}",
        )


@router.post("/stashes/{index}/pop", response_model=GitStatusResponse, summary="Pop and apply git stash")
async def pop_stash(
    company_id: UUID,
    index: int,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.pop_stash(index=index)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to pop stash: {exc}",
        )


@router.delete("/stashes/{index}", response_model=GitStashListResponse, summary="Drop git stash")
async def drop_stash(
    company_id: UUID,
    index: int,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.drop_stash(index=index)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to drop stash: {exc}",
        )


@router.get("/conflicts", response_model=ConflictCheckResponse, summary="Check for unresolved merge conflicts")
async def check_conflicts(
    company_id: UUID,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.check_conflicts()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check conflicts: {exc}",
        )


@router.get("/remotes", response_model=GitRemotesResponse, summary="List remotes and official release config")
async def get_remotes(
    company_id: UUID,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.get_remotes()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query git remotes: {exc}",
        )


@router.post("/remotes", response_model=GitRemotesResponse, summary="Configure or update git remote")
async def configure_remote(
    company_id: UUID,
    payload: ConfigureRemoteRequest,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.configure_remote(name=payload.name, url=payload.url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure remote: {exc}",
        )


@router.post("/release/sync", response_model=ReleaseSyncResponse, summary="Synchronize clean release to official repo")
async def sync_release(
    company_id: UUID,
    payload: ReleaseSyncRequest,
    service: GitService = Depends(get_git_service),
    current_user: User = Depends(get_current_user),
):
    try:
        return await service.sync_to_official_release(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Release synchronization failed: {exc}",
        )

