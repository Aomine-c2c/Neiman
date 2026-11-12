"""
Delivery Workspace and Branch Manager.

Handles:
- Isolated workspace directory creation per delivery run
- Git branch management (delivery/<run_id>)
- Patch size and diff calculations
- Budget limits enforcement (patch line count & token limits)
- Source code checkpoint snapshots and rollback restoration
"""

import shutil
import subprocess
from pathlib import Path


class DeliveryWorkspaceError(Exception):
    """Raised when delivery workspace operations fail or budget bounds are violated."""
    pass


class DeliveryWorkspaceManager:
    def __init__(self, base_workspaces_dir: str | None = None):
        if base_workspaces_dir is None:
            # Anchor inside repository's scratch directory
            repo_root = Path(__file__).resolve().parents[4]
            self.base_dir = repo_root / "scratch" / "delivery_workspaces"
        else:
            self.base_dir = Path(base_workspaces_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def get_workspace_path(self, run_id: str) -> Path:
        return self.base_dir / run_id

    def create_isolated_workspace(self, run_id: str, branch_name: str | None = None) -> Path:
        """Creates an isolated directory and initializes or resets a Git branch."""
        ws_dir = self.get_workspace_path(run_id)
        if ws_dir.exists():
            shutil.rmtree(ws_dir, ignore_errors=True)
        ws_dir.mkdir(parents=True, exist_ok=True)

        branch = branch_name or f"delivery/{run_id}"

        # Initialize local isolated git repository for the delivery run
        try:
            subprocess.run(["git", "init"], cwd=ws_dir, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "NEIMAN Autonomous Agent"], cwd=ws_dir, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "agent@neiman.os"], cwd=ws_dir, check=True, capture_output=True)
            subprocess.run(["git", "checkout", "-b", branch], cwd=ws_dir, check=True, capture_output=True)
        except Exception as exc:
            raise DeliveryWorkspaceError(f"Failed to initialize isolated git workspace: {exc}") from exc

        return ws_dir

    def commit_changes(
        self,
        run_id: str,
        commit_message: str,
        files: dict[str, str],
        max_patch_lines: int = 500,
    ) -> tuple[str, list[str], int, str]:
        """
        Writes files, validates patch-size budget limits, and creates a Git commit.
        Returns: (commit_sha, changed_files, patch_lines, diff_stat)
        """
        ws_dir = self.get_workspace_path(run_id)
        if not ws_dir.exists():
            raise DeliveryWorkspaceError(f"Workspace for run_id {run_id} does not exist")

        # Write files
        changed_files: list[str] = []
        for rel_path, content in files.items():
            file_path = ws_dir / rel_path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content, encoding="utf-8")
            changed_files.append(rel_path)

        # Stage files
        subprocess.run(["git", "add", "."], cwd=ws_dir, check=True, capture_output=True)

        # Calculate patch diff before commit
        diff_proc = subprocess.run(["git", "diff", "--cached"], cwd=ws_dir, capture_output=True, text=True)
        diff_text = diff_proc.stdout

        # Count added/modified lines in patch
        patch_lines = sum(
            1 for line in diff_text.splitlines()
            if line.startswith("+") and not line.startswith("+++")
        )

        # Enforce patch-size budget
        if patch_lines > max_patch_lines:
            # Unstage changes to prevent corrupt commit
            subprocess.run(["git", "reset", "HEAD"], cwd=ws_dir, capture_output=True)
            raise DeliveryWorkspaceError(
                f"Patch size budget exceeded: {patch_lines} lines added/modified > limit of {max_patch_lines} lines. "
                "Decompose task into smaller atomic deliverables."
            )

        # Commit
        commit_proc = subprocess.run(
            ["git", "commit", "-m", commit_message],
            cwd=ws_dir,
            capture_output=True,
            text=True,
        )
        if commit_proc.returncode != 0:
            raise DeliveryWorkspaceError(f"Git commit failed: {commit_proc.stderr}")

        # Get Commit SHA
        rev_proc = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=ws_dir,
            capture_output=True,
            text=True,
            check=True,
        )
        commit_sha = rev_proc.stdout.strip()

        # Get diff stat
        stat_proc = subprocess.run(
            ["git", "show", "--stat", "--oneline", commit_sha],
            cwd=ws_dir,
            capture_output=True,
            text=True,
        )
        diff_stat = stat_proc.stdout.strip()

        return commit_sha, changed_files, patch_lines, diff_stat

    def rollback_to_commit(self, run_id: str, target_sha: str) -> bool:
        """Rolls back the workspace repository to a prior verified commit."""
        ws_dir = self.get_workspace_path(run_id)
        if not ws_dir.exists():
            return False

        proc = subprocess.run(
            ["git", "reset", "--hard", target_sha],
            cwd=ws_dir,
            capture_output=True,
            text=True,
        )
        return proc.returncode == 0

    def cleanup_workspace(self, run_id: str) -> None:
        ws_dir = self.get_workspace_path(run_id)
        if ws_dir.exists():
            shutil.rmtree(ws_dir, ignore_errors=True)
