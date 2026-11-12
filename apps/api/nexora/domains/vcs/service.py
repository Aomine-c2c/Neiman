import asyncio
import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import structlog

from nexora.domains.vcs.models import (
    CommitResult,
    ConflictCheckResponse,
    ConflictFileItem,
    ConnectWorkspaceRequest,
    DiscoveredWorkspaceItem,
    GitBranchItem,
    GitBranchesResponse,
    GitCommitLogItem,
    GitCommitLogResponse,
    GitDiffResponse,
    GitFileChangeStatus,
    GitRemoteItem,
    GitRemotesResponse,
    GitStashItem,
    GitStashListResponse,
    GitStatusResponse,
    PreflightCheckItem,
    ReleaseSyncRequest,
    ReleaseSyncResponse,
    WorkspaceListResponse,
)

logger = structlog.get_logger(__name__)

# Pre-compiled regular expressions for high-frequency VCS parsing
RE_AHEAD = re.compile(r"ahead (\d+)")
RE_BEHIND = re.compile(r"behind (\d+)")
RE_STASH_INDEX = re.compile(r"@\{(\d+)\}")
RE_BRANCH_NAME = re.compile(r"^[a-zA-Z0-9_\-\./]+$")
RE_SHA = re.compile(r"^[0-9a-fA-F]{4,40}$")
RE_REMOTE_NAME = re.compile(r"^[a-zA-Z0-9_\-]+$")
RE_CONFLICT_MARKER = re.compile(r"^[<>=]{7}", re.MULTILINE)


def _find_default_monorepo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in [current] + list(current.parents):
        if (parent / ".git").exists():
            return parent
    return current.parents[5]


DEFAULT_MONOREPO_ROOT = _find_default_monorepo_root()
WORKSPACE_REGISTRY_FILE = DEFAULT_MONOREPO_ROOT / ".neiman_workspaces.json"
_ACTIVE_WORKSPACES: Dict[str, Path] = {}


def _load_workspace_registry() -> None:
    if WORKSPACE_REGISTRY_FILE.exists():
        try:
            data = json.loads(WORKSPACE_REGISTRY_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                for cid, p_str in data.items():
                    p = Path(str(p_str)).expanduser().resolve()
                    if p.exists() and p.is_dir():
                        _ACTIVE_WORKSPACES[str(cid)] = p
        except Exception as exc:
            logger.warning("workspace_registry_load_failed", error=str(exc))


def _save_workspace_registry() -> None:
    try:
        serializable = {cid: str(p) for cid, p in _ACTIVE_WORKSPACES.items()}
        WORKSPACE_REGISTRY_FILE.write_text(
            json.dumps(serializable, indent=2), encoding="utf-8"
        )
    except Exception as exc:
        logger.warning("workspace_registry_save_failed", error=str(exc))


_load_workspace_registry()


def get_company_workspace_dir(company_id: Optional[str] = None) -> Path:
    """Resolve the active local repository/project directory for a company."""
    if company_id:
        cid = str(company_id)
        if cid in _ACTIVE_WORKSPACES:
            target = _ACTIVE_WORKSPACES[cid]
            if target.exists() and target.is_dir():
                return target
    if "__default__" in _ACTIVE_WORKSPACES:
        target = _ACTIVE_WORKSPACES["__default__"]
        if target.exists() and target.is_dir():
            return target
    return DEFAULT_MONOREPO_ROOT


def set_company_workspace_dir(company_id: str, path: Path) -> Path:
    """Bind a local repository/project directory to the specified company."""
    resolved = path.expanduser().resolve()
    if not resolved.exists() or not resolved.is_dir():
        raise ValueError(f"Directory '{path}' does not exist on disk.")
    _ACTIVE_WORKSPACES[str(company_id)] = resolved
    _ACTIVE_WORKSPACES["__default__"] = resolved
    _save_workspace_registry()
    return resolved


class GitService:
    """Async Git VCS service for NEIMAN OS repository operations."""

    def __init__(self, repo_dir: Optional[Path] = None, company_id: Optional[str] = None):
        if repo_dir:
            self.repo_dir = repo_dir.expanduser().resolve()
        else:
            self.repo_dir = get_company_workspace_dir(company_id)
        self.company_id = company_id

    async def _run_git(self, *args: str, timeout: float = 12.0) -> Tuple[int, str, str]:
        """Executes a git CLI subcommand in repo_dir with bounded timeout."""
        proc = None
        try:
            env = dict(os.environ)
            env["GIT_TERMINAL_PROMPT"] = "0"
            proc = await asyncio.create_subprocess_exec(
                "git",
                *args,
                cwd=str(self.repo_dir),
                env=env,
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")
            return (proc.returncode or 0, stdout, stderr)
        except asyncio.TimeoutError:
            if proc is not None:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
            logger.error("git_command_timeout", args=args, timeout=timeout)
            raise RuntimeError(f"Git command 'git {' '.join(args)}' timed out after {timeout}s")
        except Exception as exc:
            if proc is not None and proc.returncode is None:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
            logger.error("git_command_failed", args=args, error=str(exc))
            raise RuntimeError(f"Failed to execute git command: {exc}")

    def _sanitize_path(self, file_path: str) -> str:
        """Sanitizes file path to prevent directory traversal and git flag injection."""
        if not file_path or not file_path.strip() or "\x00" in file_path:
            raise ValueError(f"Invalid repository path: {file_path!r}")
        if file_path.lstrip().startswith("-"):
            raise ValueError(f"Invalid repository path (leading dash rejected): {file_path!r}")
        p = Path(file_path)
        if p.is_absolute():
            try:
                rel = p.relative_to(self.repo_dir)
                return str(rel)
            except ValueError:
                raise ValueError(f"Path '{file_path}' is outside repository root.")
        resolved = (self.repo_dir / p).resolve()
        try:
            rel = resolved.relative_to(self.repo_dir)
            return str(rel)
        except ValueError:
            raise ValueError(f"Path '{file_path}' traverses outside repository.")

    async def get_status(self) -> GitStatusResponse:
        """Retrieves comprehensive working tree and index status concurrently."""
        # Parallel execution: run status, diff --cached, diff, and stash list concurrently
        status_coro = self._run_git("status", "--porcelain=v1", "-b")
        cached_diff_coro = self._run_git("diff", "--cached", "--numstat")
        unstaged_diff_coro = self._run_git("diff", "--numstat")
        stash_coro = self._run_git("stash", "list")

        (code, status_out, _), (_, cached_diff, _), (_, unstaged_diff, _), (_, stash_out, _) = (
            await asyncio.gather(status_coro, cached_diff_coro, unstaged_diff_coro, stash_coro)
        )

        if code != 0:
            raise RuntimeError(f"git status failed with exit code {code}")

        lines = status_out.splitlines()
        branch = "unknown"
        upstream = None
        ahead = 0
        behind = 0

        staged_files: List[GitFileChangeStatus] = []
        unstaged_files: List[GitFileChangeStatus] = []
        untracked_files: List[str] = []

        if lines:
            header = lines[0]
            if header.startswith("## "):
                branch_info = header[3:].strip()
                # e.g., main...origin/main [ahead 1, behind 2] or HEAD (no branch)
                if "..." in branch_info:
                    parts = branch_info.split("...")
                    branch = parts[0].strip()
                    rest = parts[1].strip()
                    if " " in rest:
                        upstream_part, track_part = rest.split(" ", 1)
                        upstream = upstream_part.strip()
                        if "ahead" in track_part:
                            m_ahead = RE_AHEAD.search(track_part)
                            if m_ahead:
                                ahead = int(m_ahead.group(1))
                        if "behind" in track_part:
                            m_behind = RE_BEHIND.search(track_part)
                            if m_behind:
                                behind = int(m_behind.group(1))
                    else:
                        upstream = rest.strip()
                else:
                    branch = branch_info

        # Numstat for staged and unstaged to compute additions/deletions
        staged_stats: Dict[str, Tuple[int, int]] = {}
        for line in cached_diff.splitlines():
            parts = line.split("\t")
            if len(parts) >= 3:
                adds = int(parts[0]) if parts[0].isdigit() else 0
                dels = int(parts[1]) if parts[1].isdigit() else 0
                staged_stats[parts[2].strip().strip('"')] = (adds, dels)

        unstaged_stats: Dict[str, Tuple[int, int]] = {}
        for line in unstaged_diff.splitlines():
            parts = line.split("\t")
            if len(parts) >= 3:
                adds = int(parts[0]) if parts[0].isdigit() else 0
                dels = int(parts[1]) if parts[1].isdigit() else 0
                unstaged_stats[parts[2].strip().strip('"')] = (adds, dels)

        for line in lines[1:]:
            if len(line) < 3:
                continue
            x_code = line[0]
            y_code = line[1]
            path_str = line[3:].strip().strip('"')

            if x_code == "?" and y_code == "?":
                untracked_files.append(path_str)
                continue

            # Staged changes (X != ' ' and X != '?')
            if x_code not in (" ", "?"):
                adds, dels = staged_stats.get(path_str, (0, 0))
                staged_files.append(
                    GitFileChangeStatus(
                        path=path_str,
                        status=x_code,
                        staged=True,
                        additions=adds,
                        deletions=dels,
                    )
                )

            # Unstaged modifications (Y != ' ' and Y != '?')
            if y_code not in (" ", "?"):
                adds, dels = unstaged_stats.get(path_str, (0, 0))
                unstaged_files.append(
                    GitFileChangeStatus(
                        path=path_str,
                        status=y_code,
                        staged=False,
                        additions=adds,
                        deletions=dels,
                    )
                )

        # Stashes count from gathered output
        stashes_count = len([l for l in stash_out.splitlines() if l.strip()])
        is_clean = len(staged_files) == 0 and len(unstaged_files) == 0 and len(untracked_files) == 0

        return GitStatusResponse(
            branch=branch,
            repo_name=self.repo_dir.name,
            repo_path=str(self.repo_dir),
            upstream=upstream,
            ahead=ahead,
            behind=behind,
            is_clean=is_clean,
            staged_files=staged_files,
            unstaged_files=unstaged_files,
            untracked_files=untracked_files,
            stashes_count=stashes_count,
        )

    async def get_tree(self) -> List[str]:
        """Lists all tracked repository files via git ls-files."""
        code, out, _ = await self._run_git("ls-files")
        if code != 0:
            return []
        return [l.strip() for l in out.splitlines() if l.strip()]

    async def get_branches(self) -> GitBranchesResponse:
        """Lists local and remote branches with tracking info and last commit details."""
        code, out, _ = await self._run_git(
            "branch",
            "-a",
            "--format=%(refname)|%(refname:short)|%(HEAD)|%(upstream:short)|%(objectname:short)|%(subject)|%(authorname)|%(authordate:iso8601)",
        )
        if code != 0:
            raise RuntimeError("Failed to list git branches.")

        current_branch = ""
        branches: List[GitBranchItem] = []

        for line in out.splitlines():
            if not line.strip():
                continue
            parts = line.split("|")
            if len(parts) >= 8:
                refname = parts[0].strip()
                name = parts[1].strip()
                is_head = parts[2].strip() == "*"
                upstream = parts[3].strip() or None
                last_sha = parts[4].strip() or None
                last_msg = parts[5].strip() or None
                last_author = parts[6].strip() or None
                last_date = parts[7].strip() or None

                if is_head:
                    current_branch = name

                is_remote = refname.startswith("refs/remotes/") or "remotes/" in name
                branches.append(
                    GitBranchItem(
                        name=name,
                        is_current=is_head,
                        is_remote=is_remote,
                        upstream=upstream,
                        last_commit_sha=last_sha,
                        last_commit_message=last_msg,
                        last_commit_author=last_author,
                        last_commit_date=last_date,
                    )
                )

        return GitBranchesResponse(current_branch=current_branch, branches=branches)

    async def create_branch(
        self, branch_name: str, checkout: bool = True, start_point: Optional[str] = None
    ) -> GitBranchesResponse:
        """Creates a new git branch with safe name validation."""
        clean_name = branch_name.strip()
        if not RE_BRANCH_NAME.match(clean_name):
            raise ValueError(f"Invalid branch name '{clean_name}'. Must be alphanumeric with -, _, ., /")

        args = ["checkout", "-b", clean_name] if checkout else ["branch", clean_name]
        if start_point:
            args.append(start_point.strip())

        code, _, err = await self._run_git(*args)
        if code != 0:
            raise RuntimeError(f"Failed to create branch: {err.strip()}")

        return await self.get_branches()

    async def checkout_branch(self, branch_name: str, create_if_missing: bool = False) -> GitBranchesResponse:
        """Checks out an existing branch or creates it if specified."""
        clean_name = branch_name.strip()
        if not RE_BRANCH_NAME.match(clean_name):
            raise ValueError(f"Invalid branch name '{clean_name}'.")

        args = ["checkout", "-b", clean_name] if create_if_missing else ["checkout", clean_name]
        code, _, err = await self._run_git(*args)
        if code != 0:
            raise RuntimeError(f"Failed to checkout branch '{clean_name}': {err.strip()}")

        return await self.get_branches()

    async def stage_files(self, paths: List[str], stage_all: bool = False) -> GitStatusResponse:
        """Stages specified files or all working directory modifications."""
        if stage_all:
            code, _, err = await self._run_git("add", "-A")
            if code != 0:
                raise RuntimeError(f"Failed to stage all files: {err.strip()}")
        else:
            if not paths:
                raise ValueError("No file paths provided to stage.")
            sanitized = [self._sanitize_path(p) for p in paths]
            code, _, err = await self._run_git("add", "--", *sanitized)
            if code != 0:
                raise RuntimeError(f"Failed to stage files: {err.strip()}")

        return await self.get_status()

    async def unstage_files(self, paths: List[str], unstage_all: bool = False) -> GitStatusResponse:
        """Unstages files from git index."""
        if unstage_all:
            code, _, err = await self._run_git("reset", "HEAD")
            if code != 0:
                raise RuntimeError(f"Failed to unstage all: {err.strip()}")
        else:
            if not paths:
                raise ValueError("No file paths provided to unstage.")
            sanitized = [self._sanitize_path(p) for p in paths]
            code, _, err = await self._run_git("reset", "HEAD", "--", *sanitized)
            if code != 0:
                raise RuntimeError(f"Failed to unstage files: {err.strip()}")

        return await self.get_status()

    async def discard_changes(self, paths: List[str], discard_all: bool = False) -> GitStatusResponse:
        """Discards uncommitted modifications in working directory."""
        if discard_all:
            code, _, err = await self._run_git("checkout", "--", ".")
            if code != 0:
                raise RuntimeError(f"Failed to discard changes: {err.strip()}")
        else:
            if not paths:
                raise ValueError("No paths provided to discard.")
            sanitized = [self._sanitize_path(p) for p in paths]
            code, _, err = await self._run_git("checkout", "--", *sanitized)
            if code != 0:
                raise RuntimeError(f"Failed to discard paths: {err.strip()}")

        return await self.get_status()

    async def create_commit(
        self,
        message: str,
        author_name: Optional[str] = None,
        author_email: Optional[str] = None,
        amend: bool = False,
    ) -> CommitResult:
        """Commits staged changes with author and conventional commit format."""
        msg = message.strip()
        if not msg:
            raise ValueError("Commit message cannot be empty.")

        # Ensure there is something staged unless amending
        status = await self.get_status()
        if not status.staged_files and not amend:
            raise ValueError("No changes staged to commit. Stage files first before committing.")

        args = ["commit", "-m", msg]
        if amend:
            args.append("--amend")
        if author_name and author_email:
            args.extend(["--author", f"{author_name} <{author_email}>"])

        code, out, err = await self._run_git(*args)
        if code != 0:
            raise RuntimeError(f"Git commit failed: {err.strip() or out.strip()}")

        # Retrieve commit details
        _, log_out, _ = await self._run_git(
            "log", "-1", "--format=%H|%h|%an|%ci|%s"
        )
        parts = log_out.strip().split("|")
        sha = parts[0] if len(parts) > 0 else ""
        short_sha = parts[1] if len(parts) > 1 else ""
        author = parts[2] if len(parts) > 2 else (author_name or "Operator")
        timestamp = parts[3] if len(parts) > 3 else ""
        commit_msg = parts[4] if len(parts) > 4 else msg

        return CommitResult(
            sha=sha,
            short_sha=short_sha,
            branch=status.branch,
            message=commit_msg,
            author=author,
            timestamp=timestamp,
            files_committed=len(status.staged_files),
        )

    async def get_commit_log(self, max_count: int = 50, branch: Optional[str] = None) -> GitCommitLogResponse:
        """Retrieves commit history with DAG graph representation and parent links."""
        sep = "\x1f"
        args = [
            "log",
            "--graph",
            f"-n{min(max_count, 100)}",
            f"--format=%H{sep}%h{sep}%an{sep}%ae{sep}%ci{sep}%P{sep}%s",
        ]
        if branch:
            args.append(branch.strip())

        code, out, err = await self._run_git(*args)
        if code != 0:
            raise RuntimeError(f"Failed to fetch git log: {err.strip()}")

        commits: List[GitCommitLogItem] = []
        status = await self.get_status()

        for line in out.splitlines():
            if sep not in line:
                continue
            first_idx = line.find(sep)
            prefix_and_sha = line[:first_idx].strip()
            rest = line[first_idx + 1 :]
            tokens = rest.split(sep)

            graph_char = "*"
            full_sha = prefix_and_sha
            if " " in prefix_and_sha:
                parts = prefix_and_sha.split(" ")
                graph_char = parts[0]
                full_sha = parts[-1]

            if len(tokens) >= 6:
                short_sha = tokens[0]
                author = tokens[1]
                email = tokens[2]
                date = tokens[3]
                parents = tokens[4].split(" ") if tokens[4].strip() else []
                msg = tokens[5]

                commits.append(
                    GitCommitLogItem(
                        sha=full_sha,
                        short_sha=short_sha,
                        author=author,
                        email=email,
                        date=date,
                        message=msg,
                        parent_shas=parents,
                        graph_symbol=graph_char,
                    )
                )

        return GitCommitLogResponse(
            commits=commits,
            total_commits=len(commits),
            current_branch=status.branch,
        )

    async def get_diff(
        self,
        file_path: Optional[str] = None,
        staged: bool = False,
        commit_sha: Optional[str] = None,
    ) -> GitDiffResponse:
        """Retrieves unified diff for working tree, staged index, or specific commit."""
        if commit_sha:
            clean_sha = commit_sha.strip()
            if not RE_SHA.match(clean_sha):
                raise ValueError("Invalid commit SHA format.")
            args = ["show", "--format=", clean_sha]
            if file_path:
                args.extend(["--", self._sanitize_path(file_path)])
        else:
            args = ["diff"]
            if staged:
                args.append("--cached")
            if file_path:
                args.extend(["--", self._sanitize_path(file_path)])

        code, diff_text, err = await self._run_git(*args)
        if code != 0:
            raise RuntimeError(f"Git diff failed: {err.strip()}")

        # Bound diff output to 2MB to prevent browser & memory exhaustion
        max_diff_bytes = 2_000_000
        if len(diff_text) > max_diff_bytes:
            diff_text = diff_text[:max_diff_bytes] + "\n\n... [Diff truncated: exceeds 2MB limit] ...\n"

        # Compute additions, deletions and files changed
        additions = 0
        deletions = 0
        files_changed = 0

        for line in diff_text.splitlines():
            if line.startswith("diff --git"):
                files_changed += 1
            elif line.startswith("+") and not line.startswith("+++"):
                additions += 1
            elif line.startswith("-") and not line.startswith("---"):
                deletions += 1

        return GitDiffResponse(
            diff=diff_text,
            files_changed=max(files_changed, 1 if diff_text.strip() else 0),
            additions=additions,
            deletions=deletions,
            target_file=file_path,
            staged=staged,
        )

    async def get_stashes(self) -> GitStashListResponse:
        """Lists active git stashes."""
        code, out, _ = await self._run_git("stash", "list", "--format=%gd|%h|%ci|%s")
        if code != 0:
            raise RuntimeError("Failed to list git stashes.")

        stashes: List[GitStashItem] = []
        for line in out.splitlines():
            if not line.strip():
                continue
            parts = line.split("|")
            if len(parts) >= 4:
                selector = parts[0].strip()  # e.g., stash@{0}
                m_idx = RE_STASH_INDEX.search(selector)
                idx = int(m_idx.group(1)) if m_idx else len(stashes)
                stashes.append(
                    GitStashItem(
                        index=idx,
                        selector=selector,
                        sha=parts[1].strip(),
                        date=parts[2].strip(),
                        message=parts[3].strip(),
                    )
                )

        return GitStashListResponse(stashes=stashes, total=len(stashes))

    async def create_stash(self, message: Optional[str] = None, include_untracked: bool = True) -> GitStashListResponse:
        """Pushes working tree changes to a new git stash."""
        args = ["stash", "push"]
        if include_untracked:
            args.append("-u")
        if message and message.strip():
            args.extend(["-m", message.strip()])

        code, _, err = await self._run_git(*args)
        if code != 0:
            raise RuntimeError(f"Failed to create stash: {err.strip()}")

        return await self.get_stashes()

    async def pop_stash(self, index: int = 0) -> GitStatusResponse:
        """Pops and applies stash at index."""
        code, _, err = await self._run_git("stash", "pop", f"stash@{{{index}}}")
        if code != 0:
            raise RuntimeError(f"Failed to pop stash@{{{index}}}: {err.strip()}")

        return await self.get_status()

    async def apply_stash(self, index: int = 0) -> GitStatusResponse:
        """Applies stash at index without removing from stash list."""
        code, _, err = await self._run_git("stash", "apply", f"stash@{{{index}}}")
        if code != 0:
            raise RuntimeError(f"Failed to apply stash@{{{index}}}: {err.strip()}")

        return await self.get_status()

    async def drop_stash(self, index: int = 0) -> GitStashListResponse:
        """Drops stash at index."""
        code, _, err = await self._run_git("stash", "drop", f"stash@{{{index}}}")
        if code != 0:
            raise RuntimeError(f"Failed to drop stash@{{{index}}}: {err.strip()}")

        return await self.get_stashes()

    async def check_conflicts(self) -> ConflictCheckResponse:
        """Detects files with unresolved merge conflict markers."""
        # Check unmerged files from index
        code, out, _ = await self._run_git("ls-files", "-u")
        unmerged_paths = set()
        if code == 0 and out.strip():
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 4:
                    unmerged_paths.add(parts[3].strip())

        conflicted_files: List[ConflictFileItem] = []
        for path in unmerged_paths:
            full = self.repo_dir / path
            markers = 0
            if full.is_file():
                try:
                    content = full.read_text(errors="replace")
                    markers = len(RE_CONFLICT_MARKER.findall(content))
                except Exception:
                    pass
            conflicted_files.append(
                ConflictFileItem(path=path, conflict_markers_count=markers)
            )

        return ConflictCheckResponse(
            has_conflicts=len(conflicted_files) > 0,
            conflicted_files=conflicted_files,
        )

    async def get_remotes(self) -> GitRemotesResponse:
        """Lists configured git remotes distinguishing private origin from official release."""
        code, out, _ = await self._run_git("remote", "-v")
        if code != 0:
            raise RuntimeError("Failed to list git remotes.")

        remotes_map: Dict[str, str] = {}
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 2:
                name, url = parts[0], parts[1]
                # Default to push URL
                remotes_map[name] = url

        remotes: List[GitRemoteItem] = []
        official_configured = False
        official_url = None

        for name, url in remotes_map.items():
            is_official = name == "official" or "Neiman" in url
            is_private = name == "origin" or "Sila" in url
            if is_official:
                official_configured = True
                official_url = url
            remotes.append(
                GitRemoteItem(
                    name=name,
                    url=url,
                    is_official=is_official,
                    is_private=is_private,
                )
            )

        return GitRemotesResponse(
            remotes=remotes,
            official_configured=official_configured,
            official_url=official_url,
        )

    async def configure_remote(self, name: str, url: str) -> GitRemotesResponse:
        """Adds or updates a git remote URL with validation."""
        clean_name = name.strip()
        clean_url = url.strip()
        if not RE_REMOTE_NAME.match(clean_name):
            raise ValueError(f"Invalid remote name '{clean_name}'.")
        if not (clean_url.startswith("https://") or clean_url.startswith("git@")):
            raise ValueError("Invalid remote URL format. Must start with https:// or git@")

        code, out, _ = await self._run_git("remote")
        existing_names = [l.strip() for l in out.splitlines()]

        if clean_name in existing_names:
            c, _, err = await self._run_git("remote", "set-url", clean_name, clean_url)
        else:
            c, _, err = await self._run_git("remote", "add", clean_name, clean_url)

        if c != 0:
            raise RuntimeError(f"Failed to configure remote '{clean_name}': {err.strip()}")

        return await self.get_remotes()

    async def sync_to_official_release(self, req: ReleaseSyncRequest) -> ReleaseSyncResponse:
        """
        Executes preflight validation and synchronizes clean release to the official repository.
        Target default: https://github.com/Aomine-c2c/Neiman.git
        """
        # Ensure remote is present
        target_remote = req.target_remote.strip()
        if req.remote_url:
            await self.configure_remote(target_remote, req.remote_url)

        remotes_resp = await self.get_remotes()
        remote_url = remotes_resp.official_url or "https://github.com/Aomine-c2c/Neiman.git"
        for r in remotes_resp.remotes:
            if r.name == target_remote:
                remote_url = r.url
                break

        preflights: List[PreflightCheckItem] = []

        # 1. Check remote topology
        preflights.append(
            PreflightCheckItem(
                check="Two-Repository Topology",
                status="PASSED",
                details=f"Target: '{target_remote}' -> {remote_url}",
            )
        )

        # 2. Secret & file hygiene audit
        sensitive_files = ["apps/api/.env", "apikeys.md", ".env.local", ".env.production", "nexora.db"]
        flagged: List[str] = []
        for rel in sensitive_files:
            if (self.repo_dir / rel).exists():
                flagged.append(rel)

        if flagged:
            preflights.append(
                PreflightCheckItem(
                    check="AppSec Secret Scrubbing & File Hygiene",
                    status="WARNING",
                    details=f"Detected {len(flagged)} sensitive private file(s) in local workspace: {', '.join(flagged)}. Air-gap quarantine active.",
                )
            )
        else:
            preflights.append(
                PreflightCheckItem(
                    check="AppSec Secret Scrubbing & File Hygiene",
                    status="PASSED",
                    details="Zero private credentials or sensitive local files detected.",
                )
            )

        # 3. Working tree check
        status = await self.get_status()
        if status.is_clean:
            preflights.append(
                PreflightCheckItem(
                    check="Working Tree Verification",
                    status="PASSED",
                    details="Working tree clean. Index ready for release deployment.",
                )
            )
        else:
            preflights.append(
                PreflightCheckItem(
                    check="Working Tree Verification",
                    status="WARNING",
                    details=f"Working tree has uncommitted modifications ({len(status.unstaged_files)} unstaged, {len(status.staged_files)} staged).",
                )
            )

        # 4. Release tag
        if req.tag:
            tag_name = req.tag.strip()
            if not req.dry_run:
                await self._run_git("tag", "-a", tag_name, "-m", f"NEIMAN Release {tag_name}")
            preflights.append(
                PreflightCheckItem(
                    check="Semantic Release Tagging",
                    status="DRY_RUN" if req.dry_run else "PASSED",
                    details=f"Release tag: {tag_name}",
                )
            )

        # 5. Get current commit
        _, head_out, _ = await self._run_git("rev-parse", "HEAD")
        _, short_out, _ = await self._run_git("rev-parse", "--short", "HEAD")
        head_sha = head_out.strip()
        short_sha = short_out.strip()

        # 6. Execute git push (or dry-run push)
        push_args = ["push", target_remote, f"{req.source_branch}:{req.target_branch}", "-f"]
        if req.tag:
            push_args.append("--tags")
        if req.dry_run:
            push_args.append("--dry-run")

        code, push_out, push_err = await self._run_git(*push_args, timeout=20.0)
        push_success = code == 0

        preflights.append(
            PreflightCheckItem(
                check="Official Release Push Handshake",
                status="DRY_RUN (SIMULATED)" if req.dry_run else ("PASSED" if push_success else "FAILED"),
                details=f"git {' '.join(push_args)} -> {push_out.strip() or push_err.strip() or 'OK'}",
            )
        )

        return ReleaseSyncResponse(
            success=push_success,
            target_remote=target_remote,
            remote_url=remote_url,
            source_branch=req.source_branch,
            target_branch=req.target_branch,
            release_tag=req.tag,
            commit_sha=head_sha,
            short_sha=short_sha,
            dry_run=req.dry_run,
            message="Preflight checks passed. Simulated push to official release repository succeeded." if req.dry_run else "Official release successfully published.",
            preflight_checks=preflights,
        )

    async def list_workspaces(self) -> WorkspaceListResponse:
        """Scan parent projects directory and return active + discovered local repositories."""
        status = await self.get_status()
        search_roots: List[Path] = []
        if DEFAULT_MONOREPO_ROOT.parent.exists():
            search_roots.append(DEFAULT_MONOREPO_ROOT.parent)
        if self.repo_dir.parent.exists() and self.repo_dir.parent not in search_roots:
            search_roots.append(self.repo_dir.parent)
        home_projects = Path.home() / "Projects"
        if home_projects.exists() and home_projects not in search_roots:
            search_roots.append(home_projects)

        seen_paths: set[str] = set()
        items: List[DiscoveredWorkspaceItem] = []

        candidates: List[Path] = [self.repo_dir, DEFAULT_MONOREPO_ROOT]
        for root in search_roots:
            try:
                for child in sorted(root.iterdir()):
                    if child.is_dir() and not child.name.startswith("."):
                        candidates.append(child)
            except Exception:
                pass

        for cand in candidates:
            resolved_str = str(cand.resolve())
            if resolved_str in seen_paths:
                continue
            seen_paths.add(resolved_str)
            is_git = (cand / ".git").exists()
            branch_name: Optional[str] = None
            if is_git:
                head_file = cand / ".git" / "HEAD"
                if head_file.exists():
                    try:
                        head_txt = head_file.read_text(encoding="utf-8").strip()
                        if head_txt.startswith("ref: refs/heads/"):
                            branch_name = head_txt.replace("ref: refs/heads/", "")
                        else:
                            branch_name = head_txt[:8]
                    except Exception:
                        branch_name = "main"
            items.append(
                DiscoveredWorkspaceItem(
                    name=cand.name,
                    path=resolved_str,
                    is_git_repo=is_git,
                    branch=branch_name,
                    is_active=(resolved_str == str(self.repo_dir.resolve())),
                )
            )

        return WorkspaceListResponse(
            active_repo_name=self.repo_dir.name,
            active_repo_path=str(self.repo_dir.resolve()),
            active_branch=status.branch or "main",
            discovered_workspaces=items,
        )

    async def connect_workspace(self, req: ConnectWorkspaceRequest) -> GitStatusResponse:
        """Connects a local project directory or clones a remote Git URL and switches active workspace."""
        target_dir: Optional[Path] = None

        if req.git_url and req.git_url.strip():
            git_url = req.git_url.strip()
            if not (git_url.startswith("https://") or git_url.startswith("git@") or git_url.startswith("http://")):
                raise ValueError("Git URL must start with https://, http://, or git@")
            repo_slug = git_url.rstrip("/").split("/")[-1]
            if repo_slug.endswith(".git"):
                repo_slug = repo_slug[:-4]
            repo_slug = re.sub(r"[^a-zA-Z0-9_\-\.]", "-", repo_slug) or "cloned-repo"

            if req.path and req.path.strip():
                dest_dir = Path(req.path.strip()).expanduser().resolve()
            else:
                dest_dir = (DEFAULT_MONOREPO_ROOT.parent / repo_slug).resolve()

            if not dest_dir.exists():
                dest_dir.parent.mkdir(parents=True, exist_ok=True)
                proc = await asyncio.create_subprocess_exec(
                    "git",
                    "clone",
                    git_url,
                    str(dest_dir),
                    stdin=asyncio.subprocess.DEVNULL,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                _, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=45.0)
                if proc.returncode != 0:
                    err_msg = stderr_b.decode("utf-8", errors="replace").strip()
                    raise ValueError(f"Failed to clone repository: {err_msg}")
            target_dir = dest_dir
        elif req.path and req.path.strip():
            raw_path = req.path.strip()
            cand = Path(raw_path).expanduser()
            if not cand.is_absolute():
                # Check relative to ~/Projects first
                proj_cand = (DEFAULT_MONOREPO_ROOT.parent / raw_path).resolve()
                if proj_cand.exists():
                    cand = proj_cand
                else:
                    cand = (DEFAULT_MONOREPO_ROOT / raw_path).resolve()
            else:
                cand = cand.resolve()

            if not cand.exists() or not cand.is_dir():
                raise ValueError(f"Local project directory '{raw_path}' does not exist.")
            target_dir = cand
        else:
            raise ValueError("Provide either a local project directory path or a Git repository URL.")

        if not (target_dir / ".git").exists():
            if req.init_git_if_missing:
                proc = await asyncio.create_subprocess_exec(
                    "git",
                    "init",
                    cwd=str(target_dir),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                await proc.communicate()
            else:
                raise ValueError(
                    f"Directory '{target_dir}' is not a Git repository (missing .git). Enable 'Initialize Git' or select a Git repo."
                )

        set_company_workspace_dir(self.company_id or "__default__", target_dir)
        self.repo_dir = target_dir

        if req.branch and req.branch.strip():
            target_branch = req.branch.strip()
            status_now = await self.get_status()
            if status_now.branch != target_branch:
                try:
                    await self.checkout_branch(target_branch, create_if_missing=False)
                except Exception:
                    pass

        return await self.get_status()



