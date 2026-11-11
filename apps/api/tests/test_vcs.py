import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from nexora.domains.auth.models import User
from nexora.domains.vcs.service import GitService
from nexora.main import create_app


@pytest.fixture
def git_service():
    return GitService()


@pytest.fixture
def mock_user():
    return User(
        id=uuid.uuid4(),
        email="test_operator@neiman.ai",
        is_active=True,
        is_superuser=False,
    )


@pytest.mark.asyncio
async def test_git_service_tree(git_service: GitService):
    tree = await git_service.get_tree()
    assert isinstance(tree, list)
    assert len(tree) > 0
    assert any("pyproject.toml" in p or "package.json" in p for p in tree)


@pytest.mark.asyncio
async def test_git_service_status(git_service: GitService):
    status = await git_service.get_status()
    assert status.branch != ""
    assert isinstance(status.is_clean, bool)
    assert isinstance(status.staged_files, list)
    assert isinstance(status.unstaged_files, list)
    assert isinstance(status.untracked_files, list)
    assert isinstance(status.stashes_count, int)


@pytest.mark.asyncio
async def test_git_service_branches(git_service: GitService):
    branches_resp = await git_service.get_branches()
    assert branches_resp.current_branch != ""
    assert len(branches_resp.branches) > 0
    current_found = any(b.is_current for b in branches_resp.branches)
    assert current_found is True


@pytest.mark.asyncio
async def test_git_service_commit_log(git_service: GitService):
    log_resp = await git_service.get_commit_log(max_count=10)
    assert log_resp.total_commits > 0
    assert len(log_resp.commits) > 0
    top_commit = log_resp.commits[0]
    assert len(top_commit.sha) > 0
    assert len(top_commit.short_sha) > 0
    assert top_commit.author != ""
    assert top_commit.message != ""


@pytest.mark.asyncio
async def test_git_service_diff(git_service: GitService):
    diff_resp = await git_service.get_diff(staged=False)
    assert isinstance(diff_resp.diff, str)
    assert isinstance(diff_resp.files_changed, int)
    assert isinstance(diff_resp.additions, int)
    assert isinstance(diff_resp.deletions, int)


@pytest.mark.asyncio
async def test_git_service_stashes_and_conflicts(git_service: GitService):
    stash_resp = await git_service.get_stashes()
    assert isinstance(stash_resp.stashes, list)
    assert isinstance(stash_resp.total, int)

    conflict_resp = await git_service.check_conflicts()
    assert isinstance(conflict_resp.has_conflicts, bool)
    assert isinstance(conflict_resp.conflicted_files, list)


@pytest.mark.asyncio
async def test_git_service_security_and_validation(git_service: GitService):
    with pytest.raises(ValueError, match="outside repository"):
        git_service._sanitize_path("../../../etc/passwd")

    with pytest.raises(ValueError, match="Commit message cannot be empty"):
        await git_service.create_commit(message="   ")

    with pytest.raises(ValueError, match="Invalid branch name"):
        await git_service.create_branch(branch_name="invalid branch; name*")


@pytest.mark.asyncio
async def test_vcs_api_endpoints(mock_user: User):
    app = create_app()
    company_id = uuid.uuid4()

    # Override auth dependency
    from nexora.domains.auth.router import get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Status
        res = await client.get(f"/api/v1/companies/{company_id}/vcs/status")
        assert res.status_code == 200
        data = res.json()
        assert "branch" in data
        assert "is_clean" in data
        assert "staged_files" in data

        # 2. Branches
        res = await client.get(f"/api/v1/companies/{company_id}/vcs/branches")
        assert res.status_code == 200
        data = res.json()
        assert "current_branch" in data
        assert "branches" in data

        # 3. Log
        res = await client.get(f"/api/v1/companies/{company_id}/vcs/log?max_count=5")
        assert res.status_code == 200
        data = res.json()
        assert "commits" in data
        assert len(data["commits"]) > 0

        # 4. Diff
        res = await client.get(f"/api/v1/companies/{company_id}/vcs/diff")
        assert res.status_code == 200
        data = res.json()
        assert "diff" in data

        # 5. Stashes
        res = await client.get(f"/api/v1/companies/{company_id}/vcs/stashes")
        assert res.status_code == 200
        data = res.json()
        assert "stashes" in data

        # 6. Conflicts
        res = await client.get(f"/api/v1/companies/{company_id}/vcs/conflicts")
        assert res.status_code == 200
        data = res.json()
        assert "has_conflicts" in data

        # 7. Remotes
        res = await client.get(f"/api/v1/companies/{company_id}/vcs/remotes")
        assert res.status_code == 200
        data = res.json()
        assert "remotes" in data
        assert "official_configured" in data
        assert any(r["name"] == "official" for r in data["remotes"])

        # 8. Release Sync Dry-run
        res = await client.post(
            f"/api/v1/companies/{company_id}/vcs/release/sync",
            json={"target_remote": "official", "dry_run": True},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["dry_run"] is True
        assert data["target_remote"] == "official"
        assert "preflight_checks" in data
        assert len(data["preflight_checks"]) >= 3

        # 9. Invalid commit payload rejection
        res = await client.post(
            f"/api/v1/companies/{company_id}/vcs/commit",
            json={"message": ""},
        )
        assert res.status_code == 400

        # 10. Repository File Tree
        res = await client.get(f"/api/v1/companies/{company_id}/vcs/tree")
        assert res.status_code == 200
        tree_data = res.json()
        assert isinstance(tree_data, list)
        assert len(tree_data) > 0


@pytest.mark.asyncio
async def test_git_service_remotes_and_release_sync(git_service: GitService):
    from nexora.domains.vcs.models import ReleaseSyncRequest

    remotes = await git_service.get_remotes()
    assert len(remotes.remotes) >= 1
    assert remotes.official_configured is True
    assert "Neiman" in (remotes.official_url or "")

    sync_resp = await git_service.sync_to_official_release(
        ReleaseSyncRequest(target_remote="official", dry_run=True)
    )
    assert sync_resp.target_remote == "official"
    assert sync_resp.dry_run is True
    assert len(sync_resp.preflight_checks) >= 3

